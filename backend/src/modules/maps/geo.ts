import { readFileSync } from 'node:fs';
import { INDIAN_STATES, type StateCode } from '../../common/constants.js';

/**
 * Offline state lookup from bundled India state/UT boundaries (backend/data/india-state-boundaries.json,
 * geoBoundaries / DataMeet, CC BY 2.5 IN). Used to work out which states a trip touches (Feature 05
 * MAP-005) without trusting free-text address components or sending extra requests to the maps provider.
 */

export type LatLng = { latitude: number; longitude: number };

type StateShape = { code: StateCode; bbox: [number, number, number, number]; polygons: number[][][] };

let shapes: StateShape[] | null = null;

function loadShapes(): StateShape[] {
  if (shapes) return shapes;
  // Same relative path from src/modules/maps and dist/modules/maps.
  const file = new URL('../../../data/india-state-boundaries.json', import.meta.url);
  const data = JSON.parse(readFileSync(file, 'utf8')) as { states: StateShape[] };
  shapes = data.states.filter((s) => s.code in INDIAN_STATES);
  return shapes;
}

/** Ray casting on a flat [lng, lat, lng, lat, …] ring. */
function inRing(ring: number[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(rings: number[][], x: number, y: number) {
  if (!inRing(rings[0], x, y)) return false;
  for (let k = 1; k < rings.length; k++) if (inRing(rings[k], x, y)) return false; // holes
  return true;
}

const EARTH_RADIUS_M = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineMeters(a: LatLng, b: LatLng) {
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Approximate distance (m) from a point to a segment, using a local equirectangular projection. */
function pointToSegmentMeters(p: LatLng, ax: number, ay: number, bx: number, by: number) {
  const k = Math.cos(rad(p.latitude));
  const px = p.longitude * k, py = p.latitude;
  const x1 = ax * k, y1 = ay, x2 = bx * k, y2 = by;
  const dx = x2 - x1, dy = y2 - y1;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy) * (Math.PI / 180) * EARTH_RADIUS_M;
}

/** State containing the point, or null when it lies outside every Indian state polygon. */
export function stateAt(p: LatLng): StateCode | null {
  const x = p.longitude, y = p.latitude;
  for (const s of loadShapes()) {
    const [minX, minY, maxX, maxY] = s.bbox;
    if (x < minX || x > maxX || y < minY || y > maxY) continue;
    if (s.polygons.some((poly) => inPolygon(poly, x, y))) return s.code;
  }
  return null;
}

/**
 * Like `stateAt`, but a point just outside every polygon (coastline or border simplification) snaps to
 * the nearest state when it is within `toleranceMeters`. Returns null if nothing is close enough.
 */
export function stateNear(p: LatLng, toleranceMeters = 2000): StateCode | null {
  const exact = stateAt(p);
  if (exact) return exact;
  const pad = toleranceMeters / 100_000 + 0.01; // generous degree padding for the bbox prefilter
  let best: { code: StateCode; d: number } | null = null;
  for (const s of loadShapes()) {
    const [minX, minY, maxX, maxY] = s.bbox;
    if (p.longitude < minX - pad || p.longitude > maxX + pad || p.latitude < minY - pad || p.latitude > maxY + pad) continue;
    for (const poly of s.polygons) {
      const ring = poly[0];
      for (let i = 0; i + 3 < ring.length; i += 2) {
        const d = pointToSegmentMeters(p, ring[i], ring[i + 1], ring[i + 2], ring[i + 3]);
        if (d <= toleranceMeters && (!best || d < best.d)) best = { code: s.code, d };
      }
    }
  }
  return best?.code ?? null;
}

/** Evenly spaced points on the straight line between a and b (both ends excluded). */
export function sampleStraightLine(a: LatLng, b: LatLng, stepMeters: number) {
  const n = Math.max(1, Math.ceil(haversineMeters(a, b) / stepMeters));
  const points: LatLng[] = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    points.push({ latitude: a.latitude + (b.latitude - a.latitude) * t, longitude: a.longitude + (b.longitude - a.longitude) * t });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Provider state names → ISO codes (used only as a cross-check against the polygons)
// ---------------------------------------------------------------------------

const normalise = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z]/g, '');

const NAME_TO_CODE = new Map<string, StateCode>(
  Object.entries(INDIAN_STATES).map(([code, name]) => [normalise(name), code as StateCode]),
);
for (const [alias, code] of [
  ['Orissa', 'OR'],
  ['Pondicherry', 'PY'],
  ['NCT of Delhi', 'DL'],
  ['National Capital Territory of Delhi', 'DL'],
  ['New Delhi', 'DL'],
  ['Uttaranchal', 'UT'],
  ['Dadra and Nagar Haveli', 'DH'],
  ['Daman and Diu', 'DH'],
  ['Andaman and Nicobar', 'AN'],
] as const) {
  NAME_TO_CODE.set(normalise(alias), code);
}

export const stateCodeFromName = (name: string | null | undefined): StateCode | null =>
  name ? (NAME_TO_CODE.get(normalise(name)) ?? null) : null;
