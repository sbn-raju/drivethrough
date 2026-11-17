/**
 * Configurable ranking (Feature 06 §5). Runs only on drivers that already passed every hard eligibility
 * filter — ranking can reorder results but never add an ineligible driver. Factors are transparent and
 * job-related; nothing about a driver's identity (name, age, gender, religion…) is used.
 */

export type RankInput = {
  driverId: string;
  hourlyRateMinor: number;
  experienceYears: number;
  slackMinutes: number;
  homeStateIsPickupState: boolean;
};

export const RANKING_WEIGHTS = {
  /** More availability around the trip = less likely to fall through. */
  availabilityFit: 0.3,
  /** Lower hourly rate ranks higher (relative to the other eligible drivers). */
  rate: 0.3,
  experience: 0.25,
  /** Proxy for distance to pickup until driver base locations are captured. */
  basedInPickupState: 0.15,
  /** Reserved until reviews (Feature 11) and booking history (Feature 08) exist. */
  rating: 0,
  reliability: 0,
} as const;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function rank<T extends RankInput>(drivers: T[]): (T & { score: number })[] {
  const rates = drivers.map((d) => d.hourlyRateMinor);
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);
  const w = RANKING_WEIGHTS;

  return drivers
    .map((d) => {
      const rateScore = maxRate === minRate ? 1 : 1 - (d.hourlyRateMinor - minRate) / (maxRate - minRate);
      const score =
        w.availabilityFit * clamp01(d.slackMinutes / 240) +
        w.rate * rateScore +
        w.experience * clamp01(d.experienceYears / 15) +
        w.basedInPickupState * (d.homeStateIsPickupState ? 1 : 0);
      return { ...d, score: Math.round(score * 1000) / 1000 };
    })
    .sort((a, b) => b.score - a.score || a.hourlyRateMinor - b.hourlyRateMinor || a.driverId.localeCompare(b.driverId));
}
