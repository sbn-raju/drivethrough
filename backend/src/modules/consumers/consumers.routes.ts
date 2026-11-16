import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { consumerProfiles, fuelType, transmission, vehicles, vehicleType } from '../../db/schema.js';
import { badRequest, notFound } from '../../common/errors/app-error.js';
import { requireAuth, requireRole } from '../../common/middleware/auth.js';
import { parse } from '../../common/middleware/validate.js';
import { phoneSchema } from '../../common/utils/contact.js';

/** Feature 02 — consumer profile and vehicles. Consumers can only ever touch their own records. */
export const consumersRouter = Router();
consumersRouter.use(requireAuth, requireRole('consumer'));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(120),
  address: optionalText(300),
  city: optionalText(80),
});

const emergencyContactSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name.').max(120),
  phone: phoneSchema,
});

const vehicleSchema = z.object({
  make: z.string().trim().min(1, 'Enter the vehicle make.').max(60),
  model: z.string().trim().min(1, 'Enter the vehicle model.').max(60),
  vehicleType: z.enum(vehicleType.enumValues, { message: 'Choose a vehicle type.' }),
  transmission: z.enum(transmission.enumValues, { message: 'Choose a transmission.' }),
  fuelType: z.enum(fuelType.enumValues).optional().nullable(),
  registrationReference: z
    .string()
    .trim()
    .toUpperCase()
    .max(20)
    .regex(/^[A-Z0-9 -]*$/, 'Use letters, numbers and spaces only.')
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  notes: optionalText(500),
});

const vehicleColumns = {
  id: vehicles.id,
  make: vehicles.make,
  model: vehicles.model,
  vehicleType: vehicles.vehicleType,
  transmission: vehicles.transmission,
  fuelType: vehicles.fuelType,
  registrationReference: vehicles.registrationReference,
  notes: vehicles.notes,
  status: vehicles.status,
  createdAt: vehicles.createdAt,
};

async function getProfile(userId: string) {
  const [profile] = await db.select().from(consumerProfiles).where(eq(consumerProfiles.userId, userId)).limit(1);
  if (profile) return profile;
  const [created] = await db.insert(consumerProfiles).values({ userId }).onConflictDoNothing().returning();
  return created ?? (await db.select().from(consumerProfiles).where(eq(consumerProfiles.userId, userId)))[0];
}

const presentProfile = (p: typeof consumerProfiles.$inferSelect) => ({
  fullName: p.fullName,
  address: p.address,
  city: p.city,
  identityStatus: p.identityStatus,
  emergencyContact: p.emergencyContactName
    ? { name: p.emergencyContactName, phone: p.emergencyContactPhone }
    : null,
  onboardingCompleted: !!p.onboardingCompletedAt,
});

// GET /consumers/me
consumersRouter.get('/me', async (req, res) => {
  const profile = await getProfile(req.user!.id);
  const list = await db
    .select(vehicleColumns)
    .from(vehicles)
    .where(eq(vehicles.consumerId, req.user!.id))
    .orderBy(desc(vehicles.createdAt));
  res.json({ profile: presentProfile(profile), vehicles: list });
});

// PATCH /consumers/me
consumersRouter.patch('/me', async (req, res) => {
  const input = parse(profileSchema, req.body);
  await getProfile(req.user!.id);
  const [updated] = await db
    .update(consumerProfiles)
    .set(input)
    .where(eq(consumerProfiles.userId, req.user!.id))
    .returning();
  res.json({ profile: presentProfile(updated) });
});

// PUT /consumers/me/emergency-contact
consumersRouter.put('/me/emergency-contact', async (req, res) => {
  const input = parse(emergencyContactSchema, req.body);
  await getProfile(req.user!.id);
  const [updated] = await db
    .update(consumerProfiles)
    .set({ emergencyContactName: input.name, emergencyContactPhone: input.phone })
    .where(eq(consumerProfiles.userId, req.user!.id))
    .returning();
  res.json({ profile: presentProfile(updated) });
});

// POST /consumers/me/onboarding/complete
consumersRouter.post('/me/onboarding/complete', async (req, res) => {
  const profile = await getProfile(req.user!.id);
  if (!profile.fullName) throw badRequest('Add your name before finishing setup.', 'PROFILE_INCOMPLETE');
  const [updated] = await db
    .update(consumerProfiles)
    .set({ onboardingCompletedAt: profile.onboardingCompletedAt ?? new Date() })
    .where(eq(consumerProfiles.userId, req.user!.id))
    .returning();
  res.json({ profile: presentProfile(updated) });
});

// GET /consumers/me/vehicles
consumersRouter.get('/me/vehicles', async (req, res) => {
  const list = await db
    .select(vehicleColumns)
    .from(vehicles)
    .where(eq(vehicles.consumerId, req.user!.id))
    .orderBy(desc(vehicles.createdAt));
  res.json({ vehicles: list });
});

// POST /consumers/me/vehicles
consumersRouter.post('/me/vehicles', async (req, res) => {
  const input = parse(vehicleSchema, req.body);
  const [vehicle] = await db
    .insert(vehicles)
    .values({ ...input, consumerId: req.user!.id })
    .returning(vehicleColumns);
  res.status(201).json({ vehicle });
});

// PATCH /consumers/me/vehicles/:vehicleId
consumersRouter.patch('/me/vehicles/:vehicleId', async (req, res) => {
  const id = parse(z.uuid(), req.params.vehicleId);
  const input = parse(vehicleSchema.partial(), req.body);
  const [vehicle] = await db
    .update(vehicles)
    .set(input)
    .where(and(eq(vehicles.id, id), eq(vehicles.consumerId, req.user!.id)))
    .returning(vehicleColumns);
  if (!vehicle) throw notFound('Vehicle not found.');
  res.json({ vehicle });
});

// DELETE /consumers/me/vehicles/:vehicleId — deactivates (bookings may still reference it)
consumersRouter.delete('/me/vehicles/:vehicleId', async (req, res) => {
  const id = parse(z.uuid(), req.params.vehicleId);
  const [vehicle] = await db
    .update(vehicles)
    .set({ status: 'inactive' })
    .where(and(eq(vehicles.id, id), eq(vehicles.consumerId, req.user!.id)))
    .returning(vehicleColumns);
  if (!vehicle) throw notFound('Vehicle not found.');
  res.json({ vehicle });
});
