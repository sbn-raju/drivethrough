import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';

/**
 * Uber Maps API client (https://developer.uber.com/docs/maps/introduction).
 *
 * - Auth: OAuth 2.0 client credentials, app-level token valid ~30 days. Cached in memory and requested
 *   again before expiry or after a 401. The secret and token never leave the server.
 * - Places: autocomplete → details (coordinates + address components). Uber's endpoints are `/maps/beta/*`;
 *   response shapes are parsed defensively because the published examples are inconsistent.
 * - Routing: `/v2/eta/predict` returns drive time and distance only — no route geometry.
 * - Every failure maps to a retryable `MAPS_UNAVAILABLE` (or `MAPS_QUOTA`) error. Callers must never
 *   fabricate a distance, duration or fare when this throws (Feature 05 MAP-006).
 */

const SCOPES = 'maps-apis maps.routing';

export type PlaceSuggestion = { id: string; name: string; address: string };
export type PlaceDetails = {
  id: string;
  name: string | null;
  address: string;
  latitude: number;
  longitude: number;
  components: { name: string; abbreviation: string | null; type: string }[];
};
export type EtaResult = { durationSeconds: number; distanceMeters: number; raw: Record<string, unknown> };

const unavailable = (detail: string) => {
  console.error('[maps] uber error:', detail);
  return new AppError(503, 'MAPS_UNAVAILABLE', "We couldn't reach the maps service. Please try again in a moment.", {
    retryable: true,
  });
};

export const mapsConfigured = () => !!(env.UBER_CLIENT_ID && env.UBER_CLIENT_SECRET);

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

let token: { value: string; expiresAt: number } | null = null;
let tokenInFlight: Promise<string> | null = null;

async function getToken(forceNew = false): Promise<string> {
  if (!mapsConfigured()) {
    throw new AppError(503, 'MAPS_NOT_CONFIGURED', 'Trip planning is temporarily unavailable.', { retryable: false });
  }
  // Renew a day early so a long-running request never carries an expired token.
  if (!forceNew && token && token.expiresAt - 86_400_000 > Date.now()) return token.value;

  tokenInFlight ??= (async () => {
    try {
      const res = await fetch(env.UBER_AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.UBER_CLIENT_ID!,
          client_secret: env.UBER_CLIENT_SECRET!,
          grant_type: 'client_credentials',
          scope: SCOPES,
        }),
        signal: AbortSignal.timeout(env.MAPS_TIMEOUT_MS),
      });
      const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
      if (!res.ok || !body.access_token) throw unavailable(`token request failed: HTTP ${res.status} ${body.error ?? ''}`);
      token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 2_592_000) * 1000 };
      return token.value;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw unavailable(`token request failed: ${(err as Error).name}`);
    } finally {
      tokenInFlight = null;
    }
  })();
  return tokenInFlight;
}

// ---------------------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------------------

async function call<T>(
  method: 'GET' | 'POST',
  path: string,
  opts: { query?: Record<string, string | number | undefined>; body?: unknown; headers?: Record<string, string> } = {},
  retried = false,
): Promise<T> {
  const url = new URL(path, env.UBER_API_BASE_URL);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${await getToken()}`,
        Accept: 'application/json',
        ...(opts.body !== undefined && { 'Content-Type': 'application/json' }),
        ...opts.headers,
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(env.MAPS_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw unavailable(`${path}: ${(err as Error).name === 'TimeoutError' ? 'timeout' : 'network error'}`);
  }

  if (res.status === 401 && !retried) {
    token = null;
    await getToken(true);
    return call<T>(method, path, opts, true);
  }
  if (res.status === 429) {
    console.error('[maps] uber rate limit hit on', path);
    throw new AppError(503, 'MAPS_QUOTA', 'Trip planning is busy right now. Please try again in a minute.', { retryable: true });
  }
  if (res.status === 404) return null as T;

  const data = (await res.json().catch(() => null)) as T & { code?: string; message?: string };
  if (!res.ok || data === null) throw unavailable(`${path}: HTTP ${res.status} ${data?.code ?? ''}`);
  return data;
}

// ---------------------------------------------------------------------------
// Parsing helpers — tolerate the documented shape variations
// ---------------------------------------------------------------------------

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/** GET /maps/beta/autocomplete — suggestions only (no coordinates). India only. */
export async function autocomplete(opts: {
  query: string;
  context: 'origin' | 'destination';
  near?: { latitude: number; longitude: number };
}): Promise<PlaceSuggestion[]> {
  const data = await call<Rec | null>('GET', '/maps/beta/autocomplete', {
    query: {
      query: opts.query,
      context: opts.context,
      country_code: 'IN',
      locale: 'en-IN',
      num_results: 6,
      latitude: opts.near?.latitude,
      longitude: opts.near?.longitude,
    },
  });
  const list = (isRec(data) && (Array.isArray(data.entities) ? data.entities : Array.isArray(data.addresses) ? data.addresses : [])) || [];
  const out: PlaceSuggestion[] = [];
  for (const item of list) {
    if (!isRec(item)) continue;
    const loc = isRec(item.location) ? item.location : item;
    const id = str(item.id) ?? str(loc.id);
    const address = str(loc.address);
    if (!id || !address || id.length > 200) continue;
    out.push({ id, name: str(loc.name) ?? address, address });
  }
  return out;
}

/** GET /maps/beta/details — hydrate one place. Returns null when the id is unknown. */
export async function placeDetails(id: string): Promise<PlaceDetails | null> {
  const data = await call<Rec | null>('GET', '/maps/beta/details', { query: { id, locale: 'en-IN' } });
  if (!isRec(data)) return null;
  const entity = isRec(data.entity) ? data.entity : data;
  const loc = isRec(entity.location) ? entity.location : entity;
  const coord = isRec(loc.coordinate) ? loc.coordinate : null;
  const latitude = num(coord?.latitude);
  const longitude = num(coord?.longitude);
  const address = str(loc.address);
  if (latitude === null || longitude === null || !address || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  const components = (Array.isArray(loc.address_components) ? loc.address_components : [])
    .filter(isRec)
    .map((c) => ({ name: str(c.name) ?? '', abbreviation: str(c.abbreviation), type: str(c.type) ?? '' }))
    .filter((c) => c.name && c.type);

  return { id: str(entity.id) ?? id, name: str(loc.name), address, latitude, longitude, components };
}

/**
 * POST /v2/eta/predict — driving time (s) and road distance for one origin/destination pair.
 * Uber documents no departure-time input, so this is a current-conditions estimate; the distance unit is
 * undocumented (metres per the examples) and the caller sanity-checks it against the straight-line distance.
 */
export async function predictEta(origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }): Promise<EtaResult> {
  const data = await call<Rec | null>('POST', '/v2/eta/predict', {
    body: { origin, destination, vehicle: { type: 'CAR' } },
    headers: { 'X-Uber-Origin': env.UBER_ETA_ORIGIN },
  });
  if (!isRec(data) || (data.status !== undefined && data.status !== 'OK')) throw unavailable(`eta: status ${isRec(data) ? String(data.status) : 'empty'}`);
  const durationSeconds = num(data.eta) ?? num(data.duration_seconds);
  const distanceMeters = num(data.distance) ?? num(data.distance_meters);
  if (durationSeconds === null || distanceMeters === null || durationSeconds <= 0 || distanceMeters <= 0) {
    throw unavailable('eta: missing duration/distance');
  }
  return {
    durationSeconds: Math.round(durationSeconds),
    distanceMeters: Math.round(distanceMeters),
    raw: { eta: data.eta, unmodified_eta: data.unmodified_eta, distance: data.distance, unmodified_distance: data.unmodified_distance },
  };
}

/**
 * POST /maps/beta/staticmap — signed image URL. Pins are placed by Uber place id; the line is the
 * straight segment between pickup and drop (Uber returns no road geometry). URL lifetime is undocumented,
 * so it is generated per request and never stored.
 */
export async function staticMap(opts: {
  width: number;
  height: number;
  originPlaceId: string;
  destinationPlaceId: string;
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
}): Promise<string | null> {
  const data = await call<Rec | null>('POST', '/maps/beta/staticmap', {
    body: {
      width: String(opts.width),
      height: String(opts.height),
      annotations: [
        { id: opts.originPlaceId, type: 'STATIC_MAP_ANNOTATION_TYPE_ORIGIN' },
        { id: opts.destinationPlaceId, type: 'STATIC_MAP_ANNOTATION_TYPE_DESTINATION' },
      ],
      polylines: [{ coordinates: [opts.origin, opts.destination] }],
    },
  });
  const url = isRec(data) ? str(data.url) : null;
  // Only accept an https URL on an Uber host — it goes straight into an <img src>.
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === 'uber.com' || u.hostname.endsWith('.uber.com')) ? url : null;
  } catch {
    return null;
  }
}
