import { sql } from 'drizzle-orm';

/**
 * Feature 06 hard eligibility filters 1–5 as one query. Every join and predicate is an eligibility rule;
 * nothing here is a ranking signal. Filters 6 (availability) and 7 (conflicts) run afterwards in
 * search.service.ts. Kept free of the DB connection so it can be tested against an in-memory Postgres.
 */

export type CandidateRow = {
  driver_id: string;
  full_name: string | null;
  profile_photo_key: string | null;
  experience_years: number | null;
  languages: string[];
  home_state: string | null;
  trip_types: string;
  currency: string;
  hourly_rate_minor: number;
  minimum_billable_hours: number;
};

export function buildCandidateQuery(p: {
  tripType: string;
  vehicleType: string;
  transmission: string;
  /** Every state the route touches; the driver must operate in all of them. Must be non-empty. */
  stateCodes: string[];
  /** Licence must be valid through this market-local date (YYYY-MM-DD). */
  licenceValidUntil: string;
  language?: string;
  /** Production: dummy-KYC (synthetic) licences never qualify. */
  excludeSynthetic: boolean;
}) {
  if (!p.stateCodes.length) throw new Error('buildCandidateQuery: stateCodes must not be empty');
  const statesArray = sql`array[${sql.join(p.stateCodes.map((s) => sql`${s}`), sql`, `)}]::text[]`;

  return sql`
    select u.id as driver_id, dp.full_name, dp.profile_photo_key, dp.experience_years, dp.languages, dp.home_state,
           pref.trip_types::text as trip_types, rc.currency, rc.hourly_rate_minor, rc.minimum_billable_hours
    from users u
    join driver_profiles dp on dp.user_id = u.id and dp.approval_status = 'approved'
    join driver_preferences pref on pref.driver_id = u.id and pref.is_bookable
    join driver_rate_cards rc on rc.driver_id = u.id and rc.effective_to is null
    join driver_documents lic on lic.driver_id = u.id
         and lic.document_type = 'driving_licence'
         and lic.verification_status = 'approved'
         and lic.expiry_date >= ${p.licenceValidUntil}::date
         ${p.excludeSynthetic ? sql`and not lic.is_synthetic` : sql``}
    where u.role = 'driver'
      and u.account_status = 'active'
      and ${p.tripType}::trip_type = any(pref.trip_types)
      and ${p.vehicleType}::vehicle_type = any(pref.vehicle_types)
      and ${p.transmission}::transmission = any(pref.transmissions)
      and (
        select count(distinct sa.state_code) from driver_service_areas sa
        where sa.driver_id = u.id and sa.state_code = any(${statesArray})
      ) = ${p.stateCodes.length}
      ${p.language ? sql`and ${p.language} = any(dp.languages)` : sql``}
    limit 500
  `;
}
