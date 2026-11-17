import type { Router } from 'express';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { env, isProduction } from '../../config/env.js';
import { db } from '../../db/index.js';
import {
  driverDocuments,
  driverPreferences,
  driverProfiles,
  driverRateCards,
  driverServiceAreas,
  driverWeeklyAvailability,
  transmission,
  tripType,
  vehicleType,
} from '../../db/schema.js';
import { conflict } from '../../common/errors/app-error.js';
import { parse } from '../../common/middleware/validate.js';
import { INDIAN_STATES, type StateCode } from '../../common/constants.js';
import { audit } from '../../services/audit.js';

/**
 * Feature 04 — the subset driver matching (Feature 06) depends on: trip/vehicle preferences, a versioned
 * rate card, recurring weekly availability and the bookable toggle.
 * Not yet built (rest of Feature 04): city-level areas, blocked dates, waiting rate, overnight allowance.
 */

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const nonEmptyUnique = <T extends string>(values: readonly [T, ...T[]], message: string) =>
  z
    .array(z.enum(values))
    .min(1, message)
    .transform((v) => [...new Set(v)]);

const preferencesSchema = z.object({
  tripTypes: nonEmptyUnique(tripType.enumValues, 'Choose at least one trip type.'),
  vehicleTypes: nonEmptyUnique(vehicleType.enumValues, 'Choose at least one vehicle type.'),
  transmissions: nonEmptyUnique(transmission.enumValues, 'Choose at least one transmission.'),
});

const rateCardSchema = z.object({
  /** Whole rupees per hour. Stored in paise. */
  hourlyRate: z.coerce
    .number()
    .int('Enter a whole number of rupees.')
    .min(env.RATE_HOURLY_MIN_INR, `The minimum hourly rate is ₹${env.RATE_HOURLY_MIN_INR}.`)
    .max(env.RATE_HOURLY_MAX_INR, `The maximum hourly rate is ₹${env.RATE_HOURLY_MAX_INR}.`),
  minimumBillableHours: z.coerce
    .number()
    .int('Enter whole hours.')
    .min(env.RATE_MIN_HOURS_MIN, `Minimum hours must be at least ${env.RATE_MIN_HOURS_MIN}.`)
    .max(env.RATE_MIN_HOURS_MAX, `Minimum hours can be at most ${env.RATE_MIN_HOURS_MAX}.`),
});

const windowSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1425).multipleOf(15, 'Use 15-minute steps.'),
    endMinute: z.number().int().min(15).max(1440).multipleOf(15, 'Use 15-minute steps.'),
  })
  .refine((w) => w.startMinute < w.endMinute, { message: 'End time must be after start time.', path: ['endMinute'] });

const availabilitySchema = z
  .object({ windows: z.array(windowSchema).max(28) })
  .superRefine(({ windows }, ctx) => {
    for (let d = 0; d < 7; d++) {
      const day = windows.filter((w) => w.dayOfWeek === d).sort((a, b) => a.startMinute - b.startMinute);
      if (day.length > 4) ctx.addIssue({ code: 'custom', path: ['windows'], message: 'Add at most 4 time windows per day.' });
      for (let i = 1; i < day.length; i++) {
        if (day[i].startMinute < day[i - 1].endMinute) {
          ctx.addIssue({ code: 'custom', path: ['windows'], message: 'Time windows on the same day must not overlap.' });
        }
      }
    }
  });

const bookableSchema = z.object({ isBookable: z.boolean() });

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

async function getPreferences(driverId: string) {
  await db.insert(driverPreferences).values({ driverId }).onConflictDoNothing();
  const [row] = await db.select().from(driverPreferences).where(eq(driverPreferences.driverId, driverId)).limit(1);
  return row;
}

const currentRateCard = async (driverId: string) =>
  (
    await db
      .select()
      .from(driverRateCards)
      .where(and(eq(driverRateCards.driverId, driverId), isNull(driverRateCards.effectiveTo)))
      .limit(1)
  )[0] ?? null;

/** Every reason a driver cannot be bookable right now. Empty = ready. */
async function bookableBlockers(driverId: string, accountStatus: string) {
  const [[profile], [licence], areas, prefs, rate, windows] = await Promise.all([
    db.select({ approvalStatus: driverProfiles.approvalStatus }).from(driverProfiles).where(eq(driverProfiles.userId, driverId)).limit(1),
    db
      .select()
      .from(driverDocuments)
      .where(and(eq(driverDocuments.driverId, driverId), eq(driverDocuments.documentType, 'driving_licence')))
      .limit(1),
    db.select({ code: driverServiceAreas.stateCode }).from(driverServiceAreas).where(eq(driverServiceAreas.driverId, driverId)),
    getPreferences(driverId),
    currentRateCard(driverId),
    db.select({ id: driverWeeklyAvailability.id }).from(driverWeeklyAvailability).where(eq(driverWeeklyAvailability.driverId, driverId)).limit(1),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const blockers: { key: string; label: string }[] = [];
  if (accountStatus !== 'active') blockers.push({ key: 'account', label: 'Your account is not active' });
  if (profile?.approvalStatus !== 'approved') blockers.push({ key: 'verification', label: 'Driver verification must be completed' });
  if (
    !licence ||
    licence.verificationStatus !== 'approved' ||
    !licence.expiryDate ||
    licence.expiryDate <= today ||
    (isProduction && licence.isSynthetic)
  ) {
    blockers.push({ key: 'licence', label: 'A verified, unexpired driving licence is required' });
  }
  if (!areas.length) blockers.push({ key: 'service_areas', label: 'Choose at least one operating state' });
  if (!prefs.tripTypes.length || !prefs.vehicleTypes.length || !prefs.transmissions.length) {
    blockers.push({ key: 'preferences', label: 'Set your trip and vehicle preferences' });
  }
  if (!rate) blockers.push({ key: 'rate_card', label: 'Set your hourly rate' });
  if (!windows.length) blockers.push({ key: 'availability', label: 'Add your weekly availability' });
  return blockers;
}

async function loadSettings(driverId: string, accountStatus: string) {
  const [prefs, rate, windows, areas, blockers] = await Promise.all([
    getPreferences(driverId),
    currentRateCard(driverId),
    db
      .select({
        dayOfWeek: driverWeeklyAvailability.dayOfWeek,
        startMinute: driverWeeklyAvailability.startMinute,
        endMinute: driverWeeklyAvailability.endMinute,
      })
      .from(driverWeeklyAvailability)
      .where(eq(driverWeeklyAvailability.driverId, driverId))
      .orderBy(driverWeeklyAvailability.dayOfWeek, driverWeeklyAvailability.startMinute),
    db.select({ stateCode: driverServiceAreas.stateCode }).from(driverServiceAreas).where(eq(driverServiceAreas.driverId, driverId)),
    bookableBlockers(driverId, accountStatus),
  ]);

  return {
    isBookable: prefs.isBookable && blockers.length === 0,
    bookableBlockers: blockers,
    preferences: { tripTypes: prefs.tripTypes, vehicleTypes: prefs.vehicleTypes, transmissions: prefs.transmissions },
    rateCard: rate
      ? {
          currency: rate.currency,
          hourlyRate: rate.hourlyRateMinor / 100,
          minimumBillableHours: rate.minimumBillableHours,
          effectiveFrom: rate.effectiveFrom,
        }
      : null,
    availability: { timeZone: 'Asia/Kolkata', windows },
    serviceAreas: areas.map((a) => ({ stateCode: a.stateCode, name: INDIAN_STATES[a.stateCode as StateCode] })),
    limits: {
      hourlyRateMin: env.RATE_HOURLY_MIN_INR,
      hourlyRateMax: env.RATE_HOURLY_MAX_INR,
      minimumHoursMin: env.RATE_MIN_HOURS_MIN,
      minimumHoursMax: env.RATE_MIN_HOURS_MAX,
    },
  };
}

// ---------------------------------------------------------------------------
// Routes (mounted on the driver router, which already requires auth + driver role)
// ---------------------------------------------------------------------------

export function registerDriverSettingsRoutes(router: Router) {
  // GET /drivers/me/settings
  router.get('/me/settings', async (req, res) => {
    res.json(await loadSettings(req.user!.id, req.user!.accountStatus));
  });

  // PUT /drivers/me/preferences
  router.put('/me/preferences', async (req, res) => {
    const input = parse(preferencesSchema, req.body);
    await getPreferences(req.user!.id);
    await db.update(driverPreferences).set(input).where(eq(driverPreferences.driverId, req.user!.id));
    res.json(await loadSettings(req.user!.id, req.user!.accountStatus));
  });

  // PUT /drivers/me/rate-card — closes the current version and opens a new one. Existing quotes keep their snapshot.
  router.put('/me/rate-card', async (req, res) => {
    const input = parse(rateCardSchema, req.body);
    const driverId = req.user!.id;
    const hourlyRateMinor = input.hourlyRate * 100;

    const changed = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(driverRateCards)
        .where(and(eq(driverRateCards.driverId, driverId), isNull(driverRateCards.effectiveTo)))
        .for('update')
        .limit(1);
      if (current && current.hourlyRateMinor === hourlyRateMinor && current.minimumBillableHours === input.minimumBillableHours) {
        return false;
      }
      const now = new Date();
      if (current) await tx.update(driverRateCards).set({ effectiveTo: now }).where(eq(driverRateCards.id, current.id));
      await tx.insert(driverRateCards).values({
        driverId,
        currency: 'INR',
        hourlyRateMinor,
        minimumBillableHours: input.minimumBillableHours,
        effectiveFrom: now,
      });
      return true;
    });

    if (changed) {
      await audit(req, 'driver.rate_card.updated', {
        actorUserId: driverId,
        entityType: 'driver',
        entityId: driverId,
        metadata: { hourlyRateMinor, minimumBillableHours: input.minimumBillableHours },
      });
    }
    res.json(await loadSettings(driverId, req.user!.accountStatus));
  });

  // GET /drivers/me/availability
  router.get('/me/availability', async (req, res) => {
    const { availability } = await loadSettings(req.user!.id, req.user!.accountStatus);
    res.json(availability);
  });

  // PUT /drivers/me/availability — replaces the weekly schedule (IST)
  router.put('/me/availability', async (req, res) => {
    const { windows } = parse(availabilitySchema, req.body);
    const driverId = req.user!.id;
    const prefs = await getPreferences(driverId);
    if (!windows.length && prefs.isBookable) {
      throw conflict('Turn off "Available for bookings" before clearing your whole schedule.', 'BOOKABLE_NEEDS_AVAILABILITY');
    }
    await db.transaction(async (tx) => {
      await tx.delete(driverWeeklyAvailability).where(eq(driverWeeklyAvailability.driverId, driverId));
      if (windows.length) await tx.insert(driverWeeklyAvailability).values(windows.map((w) => ({ ...w, driverId })));
    });
    res.json(await loadSettings(driverId, req.user!.accountStatus));
  });

  // PUT /drivers/me/bookable-status — turning off never cancels confirmed trips (there are none until Feature 08).
  router.put('/me/bookable-status', async (req, res) => {
    const { isBookable } = parse(bookableSchema, req.body);
    const driverId = req.user!.id;
    await getPreferences(driverId);
    if (isBookable) {
      const blockers = await bookableBlockers(driverId, req.user!.accountStatus);
      if (blockers.length) {
        throw conflict(`Before you can take bookings: ${blockers.map((b) => b.label.toLowerCase()).join('; ')}.`, 'NOT_READY_FOR_BOOKINGS');
      }
    }
    await db.update(driverPreferences).set({ isBookable }).where(eq(driverPreferences.driverId, driverId));
    await audit(req, 'driver.bookable_status.changed', { actorUserId: driverId, entityType: 'driver', entityId: driverId, metadata: { isBookable } });
    res.json(await loadSettings(driverId, req.user!.accountStatus));
  });
}
