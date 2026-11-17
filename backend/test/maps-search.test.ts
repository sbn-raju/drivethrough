import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { haversineMeters, stateAt, stateCodeFromName, stateNear } from '../src/modules/maps/geo.js';
import { deriveRouteStates } from '../src/modules/maps/route-states.js';
import { coverage } from '../src/modules/search/availability.js';
import { rank } from '../src/modules/search/ranking.js';

const HYD = { latitude: 17.385, longitude: 78.4867 };
const SECUNDERABAD = { latitude: 17.4399, longitude: 78.4983 };
const BLR = { latitude: 12.9716, longitude: 77.5946 };
const MAA = { latitude: 13.0827, longitude: 80.2707 };
const CCU = { latitude: 22.5726, longitude: 88.3639 };
const sure = (code: 'TG' | 'KA' | 'TN' | 'WB') => ({ code, certain: true });

describe('state lookup (Feature 05 MAP-005)', () => {
  it('classifies known cities', () => {
    assert.equal(stateAt(HYD), 'TG');
    assert.equal(stateAt(BLR), 'KA');
    assert.equal(stateAt({ latitude: 28.6139, longitude: 77.209 }), 'DL');
    assert.equal(stateAt({ latitude: 28.4595, longitude: 77.0266 }), 'HR');
  });
  it('returns null at sea and outside India', () => {
    assert.equal(stateAt({ latitude: 15, longitude: 70 }), null);
    assert.equal(stateNear({ latitude: 15, longitude: 70 }), null);
    assert.equal(stateAt({ latitude: 23.8103, longitude: 90.4125 }), null); // Dhaka
  });
  it('maps provider state names, including old spellings', () => {
    assert.equal(stateCodeFromName('Telangāna'), 'TG');
    assert.equal(stateCodeFromName('Orissa'), 'OR');
    assert.equal(stateCodeFromName('Jammu & Kashmir'), 'JK');
    assert.equal(stateCodeFromName('Atlantis'), null);
  });
});

describe('route state derivation', () => {
  it('same-state trip is determined', () => {
    const r = deriveRouteStates(HYD, sure('TG'), SECUNDERABAD, sure('TG'));
    assert.deepEqual(r, { codes: ['TG'], status: 'determined', method: 'endpoints' });
  });
  it('interstate trip is approximate and includes intermediate states', () => {
    const r = deriveRouteStates(HYD, sure('TG'), BLR, sure('KA'));
    assert.equal(r.status, 'approximate');
    assert.deepEqual(r.codes, ['TG', 'AP', 'KA']);
  });
  it('mostly-over-sea straight line is uncertain, never silently eligible', () => {
    const r = deriveRouteStates(MAA, sure('TN'), CCU, sure('WB'));
    assert.equal(r.status, 'uncertain');
  });
  it('an unclassified or disputed endpoint is uncertain', () => {
    assert.equal(deriveRouteStates(HYD, { code: 'TG', certain: false }, SECUNDERABAD, sure('TG')).status, 'uncertain');
    assert.equal(deriveRouteStates(HYD, { code: null, certain: false }, BLR, sure('KA')).status, 'uncertain');
  });
  it('haversine is sane', () => {
    const d = haversineMeters(HYD, BLR);
    assert.ok(d > 490_000 && d < 510_000, String(d));
  });
});

// 2026-11-18 is a Wednesday (dayOfWeek 3). IST = UTC+05:30.
const ist = (s: string) => new Date(`${s}+05:30`);

describe('weekly availability coverage (Feature 04 §5 / Feature 06 filter 6)', () => {
  const daytime = [3, 4].map((d) => ({ dayOfWeek: d, startMinute: 6 * 60, endMinute: 22 * 60 }));
  it('covers a window inside a day block', () => {
    const c = coverage(daytime, ist('2026-11-18T09:00:00'), ist('2026-11-18T15:00:00'));
    assert.ok(c);
    assert.equal(c.slackMinutes, 3 * 60 + 7 * 60);
  });
  it('rejects a window that starts before availability', () => {
    assert.equal(coverage(daytime, ist('2026-11-18T05:00:00'), ist('2026-11-18T09:00:00')), null);
  });
  it('rejects a window that spans a gap overnight', () => {
    assert.equal(coverage(daytime, ist('2026-11-18T20:00:00'), ist('2026-11-19T08:00:00')), null);
  });
  it('merges blocks across midnight', () => {
    const night = [
      { dayOfWeek: 3, startMinute: 18 * 60, endMinute: 1440 },
      { dayOfWeek: 4, startMinute: 0, endMinute: 6 * 60 },
    ];
    assert.ok(coverage(night, ist('2026-11-18T20:00:00'), ist('2026-11-19T04:00:00')));
  });
  it('wrong weekday does not count', () => {
    assert.equal(coverage([{ dayOfWeek: 1, startMinute: 0, endMinute: 1440 }], ist('2026-11-18T09:00:00'), ist('2026-11-18T10:00:00')), null);
  });
  it('no windows means unavailable', () => {
    assert.equal(coverage([], ist('2026-11-18T09:00:00'), ist('2026-11-18T10:00:00')), null);
  });
});

describe('ranking (Feature 06 §5)', () => {
  it('only reorders the drivers it is given', () => {
    const input = [
      { driverId: 'a', hourlyRateMinor: 40000, experienceYears: 2, slackMinutes: 0, homeStateIsPickupState: false },
      { driverId: 'b', hourlyRateMinor: 30000, experienceYears: 10, slackMinutes: 240, homeStateIsPickupState: true },
    ];
    const out = rank(input);
    assert.equal(out.length, 2);
    assert.deepEqual(out.map((d) => d.driverId), ['b', 'a']);
  });
});
