import { and, eq, inArray } from 'drizzle-orm';
import { env, isProduction } from '../../config/env.js';
import { db } from '../../db/index.js';
import { driverWeeklyAvailability, vehicles, type TripType } from '../../db/schema.js';
import { badRequest } from '../../common/errors/app-error.js';
import { INDIAN_STATES, type StateCode } from '../../common/constants.js';
import { signedUrlFor } from '../../services/storage.js';
import { loadOwnedEstimate, presentEstimate } from '../maps/route-estimate.service.js';
import { coverage, type WeeklyWindow } from './availability.js';
import { buildCandidateQuery, type CandidateRow } from './eligibility.sql.js';
import { rank } from './ranking.js';

/**
 * Feature 06 — driver search and matching.
 *
 * Hard eligibility filters, all enforced here on the server (§3):
 *  1. active account                     5. supports the trip type, vehicle type and transmission
 *  2. approved KYC + valid licence       6. weekly availability covers the whole window + buffers
 *  3. marked bookable                    7. no conflicting confirmed booking (Feature 08 hook below)
 *  4. operates in every state the route touches
 * Distance, duration and route states come from the stored server-side estimate — never from the client.
 */

export type SearchInput = {
  routeEstimateId: string;
  tripType: TripType;
  pickupAt: Date;
  returnAt?: Date;
  vehicleId: string;
  language?: string;
};

const MINUTE = 60_000;

/** Market-local (IST) calendar date of an instant, as YYYY-MM-DD. */
const localDate = (d: Date) => new Date(d.getTime() + env.MARKET_UTC_OFFSET_MINUTES * MINUTE).toISOString().slice(0, 10);

/**
 * Feature 08 hook: drivers with a confirmed booking overlapping [start, end). There are no bookings yet,
 * so nobody conflicts. Replace with a query on `bookings` (accepted/driver_arrived/in_progress) when the
 * booking lifecycle lands — and re-run this check inside the acceptance transaction.
 */
async function driversWithConflictingBookings(_driverIds: string[], _start: Date, _end: Date): Promise<Set<string>> {
  return new Set();
}

const displayName = (fullName: string | null) => {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'DriveThrough driver';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
};

function validateTiming(input: SearchInput, durationSeconds: number) {
  const now = Date.now();
  const lead = env.SEARCH_MIN_LEAD_MINUTES;
  if (input.pickupAt.getTime() < now + lead * MINUTE) {
    throw badRequest(`Choose a pickup time at least ${lead >= 60 ? `${Math.round(lead / 60)} hours` : `${lead} minutes`} from now.`, 'PICKUP_TOO_SOON', {
      field: 'pickupAt',
    });
  }
  if (input.pickupAt.getTime() > now + env.SEARCH_MAX_ADVANCE_DAYS * 1_440 * MINUTE) {
    throw badRequest(`You can book up to ${env.SEARCH_MAX_ADVANCE_DAYS} days ahead.`, 'PICKUP_TOO_FAR', { field: 'pickupAt' });
  }

  const outboundEnd = new Date(input.pickupAt.getTime() + durationSeconds * 1000);
  if (input.tripType === 'one_way') return { serviceStart: input.pickupAt, serviceEnd: outboundEnd };

  if (!input.returnAt) throw badRequest('Select a return date for a round trip.', 'RETURN_REQUIRED', { field: 'returnAt' });
  if (input.returnAt < outboundEnd) {
    throw badRequest('The return must start after you arrive. Choose a later return time.', 'RETURN_TOO_EARLY', { field: 'returnAt' });
  }
  if (input.returnAt.getTime() - input.pickupAt.getTime() > env.ROUND_TRIP_MAX_DAYS * 1_440 * MINUTE) {
    throw badRequest(`Round trips can be up to ${env.ROUND_TRIP_MAX_DAYS} days long.`, 'RETURN_TOO_FAR', { field: 'returnAt' });
  }
  // Return leg assumed to take as long as the outbound leg (same route, current-conditions estimate).
  return { serviceStart: input.pickupAt, serviceEnd: new Date(input.returnAt.getTime() + durationSeconds * 1000) };
}

const NO_RESULTS = {
  route_uncertain: {
    message: "We couldn't confirm which states this route passes through, so we can't match drivers automatically.",
    suggestions: ['Try a pickup or drop point on a main road or in a city centre.', 'Contact support and we will help arrange this trip.'],
  },
  state_not_served: {
    message: "This trip passes through a state we don't operate in yet.",
    suggestions: ['Choose a route within the states we currently serve.'],
  },
  no_drivers: {
    message: 'No drivers match this trip yet. Try changing your date or route.',
    suggestions: ['Try a different pickup time or date.', 'For round trips, try a shorter trip.', 'Remove the language preference, if set.'],
  },
} as const;

export async function searchDrivers(consumerId: string, input: SearchInput) {
  const estimate = await loadOwnedEstimate(consumerId, input.routeEstimateId);
  const route = await presentEstimate(estimate);

  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.id, input.vehicleId), eq(vehicles.consumerId, consumerId), eq(vehicles.status, 'active')))
    .limit(1);
  if (!vehicle) throw badRequest('Choose one of your active vehicles.', 'INVALID_VEHICLE', { field: 'vehicleId' });

  const { serviceStart, serviceEnd } = validateTiming(input, estimate.durationSeconds);
  const reservedStart = new Date(serviceStart.getTime() - env.PICKUP_BUFFER_MINUTES * MINUTE);
  const reservedEnd = new Date(serviceEnd.getTime() + env.TURNAROUND_BUFFER_MINUTES * MINUTE);

  const search = {
    routeEstimateId: estimate.id,
    tripType: input.tripType,
    pickupAt: serviceStart,
    returnAt: input.tripType === 'round_trip' ? input.returnAt : null,
    estimatedEndAt: serviceEnd,
    reservedWindow: { start: reservedStart, end: reservedEnd },
    vehicle: { id: vehicle.id, make: vehicle.make, model: vehicle.model, vehicleType: vehicle.vehicleType, transmission: vehicle.transmission },
    language: input.language ?? null,
    searchedAt: new Date(),
  };
  const empty = (reason: keyof typeof NO_RESULTS) => ({ search, route, drivers: [], noResults: { reason, ...NO_RESULTS[reason] } });

  // Never silently assume eligibility when the route's states are unknown (Feature 04 §3).
  if (!route.coverage.serviceable) return empty(route.coverage.reason ?? 'route_uncertain');

  // Filters 1–5 in SQL (eligibility.sql.ts).
  const states = estimate.routeStateCodes;
  const candidates = await db.execute<CandidateRow>(
    buildCandidateQuery({
      tripType: input.tripType,
      vehicleType: vehicle.vehicleType,
      transmission: vehicle.transmission,
      stateCodes: states,
      licenceValidUntil: localDate(reservedEnd),
      language: input.language,
      excludeSynthetic: isProduction,
    }),
  );

  if (!candidates.length) return empty('no_drivers');

  // Filter 6: availability covers the whole reserved window.
  const ids = candidates.map((c) => c.driver_id);
  const windowRows = await db
    .select({
      driverId: driverWeeklyAvailability.driverId,
      dayOfWeek: driverWeeklyAvailability.dayOfWeek,
      startMinute: driverWeeklyAvailability.startMinute,
      endMinute: driverWeeklyAvailability.endMinute,
    })
    .from(driverWeeklyAvailability)
    .where(inArray(driverWeeklyAvailability.driverId, ids));
  const byDriver = new Map<string, WeeklyWindow[]>();
  for (const w of windowRows) byDriver.set(w.driverId, [...(byDriver.get(w.driverId) ?? []), w]);

  // Filter 7: no overlapping confirmed booking.
  const conflicts = await driversWithConflictingBookings(ids, reservedStart, reservedEnd);

  const eligible = candidates.flatMap((c) => {
    if (conflicts.has(c.driver_id)) return [];
    const fit = coverage(byDriver.get(c.driver_id) ?? [], reservedStart, reservedEnd);
    if (!fit) return [];
    return [
      {
        ...c,
        driverId: c.driver_id,
        hourlyRateMinor: c.hourly_rate_minor,
        experienceYears: c.experience_years ?? 0,
        slackMinutes: fit.slackMinutes,
        homeStateIsPickupState: !!c.home_state && c.home_state === estimate.pickup.stateCode,
      },
    ];
  });
  if (!eligible.length) return empty('no_drivers');

  const ranked = rank(eligible).slice(0, 50);
  const drivers = await Promise.all(
    ranked.map(async (d) => ({
      driverId: d.driverId,
      displayName: displayName(d.full_name),
      photoUrl: d.profile_photo_key ? await signedUrlFor(d.profile_photo_key, 600) : null,
      experienceYears: d.experienceYears,
      languages: d.languages,
      // Shown as a verification indicator only — never document details (Feature 06 §6).
      verification: 'verified' as const,
      rating: null as number | null, // Reviews arrive with Feature 11.
      reviewCount: 0,
      completedTrips: 0, // Booking history arrives with Feature 08.
      rate: { currency: d.currency, hourlyRate: d.hourly_rate_minor / 100, minimumBillableHours: d.minimum_billable_hours },
      // Fare quotes (incl. one-way return compensation and the platform fee) are Feature 07.
      fareEstimate: null,
      tripTypes: d.trip_types.replace(/[{}]/g, '').split(',').filter(Boolean),
      coverage: states.map((code) => ({ code, name: INDIAN_STATES[code as StateCode] ?? code })),
      availability: 'available_for_full_trip' as const,
    })),
  );

  return { search, route, drivers, noResults: null };
}
