import type { StateCode } from '../../common/constants.js';
import { sampleStraightLine, stateAt, type LatLng } from './geo.js';

/** Spacing of the straight-line samples used to approximate interstate coverage. */
const LINE_SAMPLE_STEP_METERS = 5_000;
/** If more of the straight line than this lies outside India (sea, neighbouring country) the result is uncertain. */
const MAX_OUTSIDE_FRACTION = 0.25;
export type EndpointState = { code: StateCode | null; certain: boolean };

/** Which states the trip touches, and how sure we are (MAP-005 / Feature 04 §3). */
export function deriveRouteStates(pickup: LatLng, pickupState: EndpointState, drop: LatLng, dropState: EndpointState) {
  const ordered: StateCode[] = [];
  const add = (c: StateCode | null) => c && !ordered.includes(c) && ordered.push(c);
  let uncertain = !pickupState.certain || !dropState.certain || !pickupState.code || !dropState.code;

  add(pickupState.code);
  if (pickupState.code && pickupState.code === dropState.code) {
    return { codes: ordered, status: uncertain ? ('uncertain' as const) : ('determined' as const), method: 'endpoints' };
  }

  const samples = sampleStraightLine(pickup, drop, LINE_SAMPLE_STEP_METERS);
  let outside = 0;
  for (const p of samples) {
    const s = stateAt(p);
    if (s) add(s);
    else outside++;
  }
  add(dropState.code);
  if (samples.length && outside / samples.length > MAX_OUTSIDE_FRACTION) uncertain = true;

  return { codes: ordered, status: uncertain ? ('uncertain' as const) : ('approximate' as const), method: 'endpoints+straight_line' };
}

