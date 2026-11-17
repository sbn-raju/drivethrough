import { and, eq, inArray } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import { routeEstimates, serviceStates, type ResolvedPlace, type RouteEstimate } from '../../db/schema.js';
import { AppError, badRequest, conflict, notFound } from '../../common/errors/app-error.js';
import { INDIAN_STATES, type StateCode } from '../../common/constants.js';
import { haversineMeters, stateCodeFromName, stateNear } from './geo.js';
import { deriveRouteStates, type EndpointState } from './route-states.js';
import { placeDetails, predictEta, type PlaceDetails } from './uber.client.js';

/** Pickup and drop closer than this are treated as the same place (MAP-004). */
const MIN_TRIP_METERS = 300;
/** Longest trip we will estimate (straight-line). Anything beyond is almost certainly a bad selection. */
const MAX_TRIP_METERS = 3_000_000;
/** Endpoints this close to a state polygon snap to it (border/coastline simplification). */
const ENDPOINT_TOLERANCE_METERS = 2_000;


/**
 * State of an endpoint. The bundled polygons are authoritative; Uber's FEDERATED_STATE component is a
 * cross-check. Disagreement or a missing answer is never silently resolved in the driver's favour.
 */
function resolveEndpointState(place: PlaceDetails): EndpointState {
  const fromPolygon = stateNear(place, ENDPOINT_TOLERANCE_METERS);
  const providerName = place.components.find((c) => c.type.toUpperCase() === 'FEDERATED_STATE')?.name;
  const fromProvider = stateCodeFromName(providerName);

  if (fromPolygon && (!fromProvider || fromProvider === fromPolygon)) return { code: fromPolygon, certain: true };
  if (fromPolygon && fromProvider) return { code: fromPolygon, certain: false };
  return { code: fromProvider, certain: false };
}

function isOutsideIndia(place: PlaceDetails, state: EndpointState) {
  if (state.code) return false;
  const country = place.components.find((c) => c.type.toUpperCase() === 'COUNTRY');
  return !country || !/^(in|ind|india)$/i.test(country.abbreviation ?? country.name);
}

async function resolvePlace(id: string, which: 'pickup' | 'drop') {
  const place = await placeDetails(id);
  if (!place) {
    throw badRequest(which === 'pickup' ? 'Choose a valid pickup location.' : 'Choose a valid drop location.', 'INVALID_LOCATION', {
      field: which === 'pickup' ? 'pickupPlaceId' : 'dropPlaceId',
    });
  }
  return place;
}

const toResolved = (p: PlaceDetails, state: EndpointState): ResolvedPlace => ({
  placeId: p.id,
  formattedAddress: p.address,
  latitude: p.latitude,
  longitude: p.longitude,
  stateCode: state.code,
});

export async function createRouteEstimate(consumerId: string, input: { pickupPlaceId: string; dropPlaceId: string }) {
  if (input.pickupPlaceId === input.dropPlaceId) {
    throw badRequest('Choose a destination different from your pickup.', 'SAME_LOCATION', { field: 'dropPlaceId' });
  }

  const [pickup, drop] = await Promise.all([resolvePlace(input.pickupPlaceId, 'pickup'), resolvePlace(input.dropPlaceId, 'drop')]);
  const pickupState = resolveEndpointState(pickup);
  const dropState = resolveEndpointState(drop);

  for (const [place, state, field] of [[pickup, pickupState, 'pickupPlaceId'], [drop, dropState, 'dropPlaceId']] as const) {
    if (isOutsideIndia(place, state)) {
      throw badRequest('DriveThrough currently operates within India only. Choose a location in India.', 'OUTSIDE_SERVICE_COUNTRY', { field });
    }
  }

  const straight = haversineMeters(pickup, drop);
  if (straight < MIN_TRIP_METERS) {
    throw badRequest('Choose a destination different from your pickup.', 'SAME_LOCATION', { field: 'dropPlaceId' });
  }
  if (straight > MAX_TRIP_METERS) throw badRequest('This trip is too long to plan. Check your pickup and drop.', 'TRIP_TOO_LONG');

  const eta = await predictEta(
    { latitude: pickup.latitude, longitude: pickup.longitude },
    { latitude: drop.latitude, longitude: drop.longitude },
  );
  // Road distance can't be shorter than the straight line, or absurdly longer. If it is, the provider
  // response isn't what we expect (e.g. a unit change) — fail rather than price on bad data.
  if (eta.distanceMeters < straight * 0.9 || eta.distanceMeters > straight * 5 + 20_000) {
    console.error('[maps] implausible ETA distance', { distance: eta.distanceMeters, straight: Math.round(straight) });
    throw new AppError(503, 'MAPS_UNAVAILABLE', "We couldn't calculate this route. Please try again in a moment.", { retryable: true });
  }

  const states = deriveRouteStates(pickup, pickupState, drop, dropState);
  const now = new Date();
  const [row] = await db
    .insert(routeEstimates)
    .values({
      consumerId,
      pickup: toResolved(pickup, pickupState),
      drop: toResolved(drop, dropState),
      distanceMeters: eta.distanceMeters,
      durationSeconds: eta.durationSeconds,
      routeStateCodes: states.codes,
      coverageStatus: states.status,
      routeStateMethod: states.method,
      provider: 'uber',
      providerMetadata: { endpoint: 'v2/eta/predict', vehicle: 'CAR', ...eta.raw, straightLineMeters: Math.round(straight) },
      estimatedAt: now,
      expiresAt: new Date(now.getTime() + env.ROUTE_ESTIMATE_TTL_MINUTES * 60_000),
    })
    .returning();
  return row;
}

/** Loads an estimate the consumer owns. Expired estimates must be recalculated (MAP-007). */
export async function loadOwnedEstimate(consumerId: string, id: string, { allowExpired = false } = {}) {
  const [row] = await db
    .select()
    .from(routeEstimates)
    .where(and(eq(routeEstimates.id, id), eq(routeEstimates.consumerId, consumerId)))
    .limit(1);
  if (!row) throw notFound('Route not found. Plan your trip again.', 'ROUTE_NOT_FOUND');
  if (!allowExpired && row.expiresAt <= new Date()) {
    throw conflict('Your route estimate has expired. Check the route again to get current timings.', 'ROUTE_ESTIMATE_EXPIRED');
  }
  return row;
}

export async function enabledStateCodes(codes: string[]) {
  if (!codes.length) return new Set<string>();
  const rows = await db
    .select({ code: serviceStates.code })
    .from(serviceStates)
    .where(and(inArray(serviceStates.code, codes), eq(serviceStates.isEnabled, true)));
  return new Set(rows.map((r) => r.code));
}

const COVERAGE_NOTES = {
  determined: 'Pickup and drop are in the same state.',
  approximate:
    'Interstate trip. States are estimated from your pickup, drop and the direct line between them; drivers must operate in all of them.',
  uncertain: "We couldn't reliably work out which states this route passes through.",
} as const;

export async function presentEstimate(row: RouteEstimate) {
  const enabled = await enabledStateCodes(row.routeStateCodes);
  const place = (p: ResolvedPlace) => ({
    placeId: p.placeId,
    formattedAddress: p.formattedAddress,
    latitude: p.latitude,
    longitude: p.longitude,
    stateCode: p.stateCode,
    stateName: p.stateCode ? (INDIAN_STATES[p.stateCode as StateCode] ?? null) : null,
  });
  const states = row.routeStateCodes.map((code) => ({
    code,
    name: INDIAN_STATES[code as StateCode] ?? code,
    enabled: enabled.has(code),
  }));
  const serviceable = row.coverageStatus !== 'uncertain' && states.length > 0 && states.every((s) => s.enabled);
  return {
    id: row.id,
    pickup: place(row.pickup),
    drop: place(row.drop),
    distanceMeters: row.distanceMeters,
    durationSeconds: row.durationSeconds,
    routeStates: states,
    coverage: {
      status: row.coverageStatus,
      method: row.routeStateMethod,
      note: COVERAGE_NOTES[row.coverageStatus],
      serviceable,
      reason: (row.coverageStatus === 'uncertain'
        ? 'route_uncertain'
        : states.some((s) => !s.enabled)
          ? 'state_not_served'
          : null) as 'route_uncertain' | 'state_not_served' | null,
    },
    provider: row.provider,
    estimatedAt: row.estimatedAt,
    expiresAt: row.expiresAt,
    isEstimate: true,
  };
}
