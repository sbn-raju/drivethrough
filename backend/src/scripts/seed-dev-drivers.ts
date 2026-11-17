/**
 * DEV / TEST / STAGING ONLY — seeds synthetic, approved, bookable drivers so Feature 06 search can be
 * exercised before the admin KYC review console (Feature 12) exists.
 *
 * Dummy-KYC policy (Feature 03 §5): every record is visibly synthetic — "[TEST]" names, `@drivethrough.test`
 * emails, `is_synthetic = true` documents. Refuses to run when NODE_ENV=production, and production search
 * ignores synthetic licences anyway.
 *
 *   npm run db:seed:dev-drivers            # password defaults to TestDriver#2026
 *   SEED_DRIVER_PASSWORD=… npm run db:seed:dev-drivers
 */
import { eq } from 'drizzle-orm';
import { env, isProduction } from '../config/env.js';
import { db, sqlClient } from '../db/index.js';
import {
  driverDocuments,
  driverPreferences,
  driverProfiles,
  driverRateCards,
  driverServiceAreas,
  driverWeeklyAvailability,
  users,
  type TripType,
} from '../db/schema.js';
import { encrypt } from '../common/utils/crypto.js';
import { hashPassword } from '../common/utils/password.js';

if (isProduction || !['development', 'test', 'staging'].includes(env.NODE_ENV)) {
  console.error('Refusing to seed synthetic drivers outside development/test/staging.');
  process.exit(1);
}

type Seed = {
  name: string;
  homeCity: string;
  homeState: string;
  states: string[];
  rate: number;
  minHours: number;
  years: number;
  languages: string[];
  tripTypes: TripType[];
  transmissions: ('manual' | 'automatic')[];
  /** [startHour, endHour] every day, or 'always'. */
  hours: [number, number] | 'always';
};

const SEEDS: Seed[] = [
  { name: 'Ravi Kumar', homeCity: 'Hyderabad', homeState: 'TG', states: ['TG', 'AP', 'KA'], rate: 300, minHours: 4, years: 9, languages: ['Telugu', 'Hindi', 'English'], tripTypes: ['one_way', 'round_trip'], transmissions: ['manual', 'automatic'], hours: 'always' },
  { name: 'Suresh Reddy', homeCity: 'Hyderabad', homeState: 'TG', states: ['TG'], rate: 250, minHours: 3, years: 5, languages: ['Telugu', 'English'], tripTypes: ['one_way', 'round_trip'], transmissions: ['manual'], hours: [6, 22] },
  { name: 'Anil Sharma', homeCity: 'Vijayawada', homeState: 'AP', states: ['AP', 'TG'], rate: 280, minHours: 4, years: 12, languages: ['Telugu', 'Hindi'], tripTypes: ['one_way'], transmissions: ['manual', 'automatic'], hours: [5, 23] },
  { name: 'Manjunath Gowda', homeCity: 'Bengaluru', homeState: 'KA', states: ['KA', 'TN', 'AP', 'TG'], rate: 350, minHours: 4, years: 15, languages: ['Kannada', 'Tamil', 'English'], tripTypes: ['one_way', 'round_trip'], transmissions: ['automatic'], hours: 'always' },
  { name: 'Prakash Iyer', homeCity: 'Chennai', homeState: 'TN', states: ['TN', 'KA', 'PY'], rate: 320, minHours: 5, years: 7, languages: ['Tamil', 'English'], tripTypes: ['round_trip'], transmissions: ['manual', 'automatic'], hours: [6, 21] },
  { name: 'Vikram Singh', homeCity: 'Gurugram', homeState: 'HR', states: ['DL', 'HR', 'UP', 'RJ'], rate: 400, minHours: 4, years: 11, languages: ['Hindi', 'Punjabi', 'English'], tripTypes: ['one_way', 'round_trip'], transmissions: ['manual', 'automatic'], hours: 'always' },
  { name: 'Santosh Patil', homeCity: 'Pune', homeState: 'MH', states: ['MH', 'GA', 'KA'], rate: 330, minHours: 4, years: 8, languages: ['Marathi', 'Hindi', 'Konkani'], tripTypes: ['one_way', 'round_trip'], transmissions: ['manual'], hours: [5, 23] },
];

const password = process.env.SEED_DRIVER_PASSWORD ?? 'TestDriver#2026';

async function main() {
  const passwordHash = await hashPassword(password);
  const inFiveYears = new Date(Date.now() + 5 * 365 * 86_400_000).toISOString().slice(0, 10);
  const now = new Date();

  for (const [i, s] of SEEDS.entries()) {
    const email = `synthetic.driver${i + 1}@drivethrough.test`;
    await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ email, role: 'driver', passwordHash, accountStatus: 'active', emailVerifiedAt: now })
        .onConflictDoUpdate({ target: users.email, set: { accountStatus: 'active', role: 'driver', passwordHash } })
        .returning({ id: users.id });
      const driverId = user.id;

      const profile = {
        fullName: `[TEST] ${s.name}`,
        dateOfBirth: '1988-01-01',
        homeCity: s.homeCity,
        homeState: s.homeState,
        bio: 'Synthetic test driver — not a real person.',
        experienceYears: s.years,
        languages: s.languages,
        approvalStatus: 'approved' as const,
        submittedAt: now,
        reviewedAt: now,
        reviewReason: 'Synthetic seed (non-production dummy KYC).',
      };
      await tx.insert(driverProfiles).values({ userId: driverId, ...profile }).onConflictDoUpdate({ target: driverProfiles.userId, set: profile });

      for (const [documentType, extra] of [
        ['driving_licence', { issuingAuthority: s.homeState, issueDate: '2015-01-01', expiryDate: inFiveYears, metadata: { licenceClasses: ['LMV'] } }],
        ['identity_proof', { documentSubtype: 'aadhaar' }],
      ] as const) {
        const doc = {
          storageKey: `synthetic/seed/${driverId}/${documentType}`,
          fileName: 'synthetic-seed.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 0,
          verificationStatus: 'approved' as const,
          documentNumberEncrypted: encrypt(`TEST${String(i + 1).padStart(8, '0')}`),
          documentNumberLast4: String(i + 1).padStart(4, '0'),
          isSynthetic: true,
          reviewReason: 'Synthetic seed (non-production dummy KYC).',
          reviewedAt: now,
          ...extra,
        };
        await tx
          .insert(driverDocuments)
          .values({ driverId, documentType, ...doc })
          .onConflictDoUpdate({ target: [driverDocuments.driverId, driverDocuments.documentType], set: doc });
      }

      await tx.delete(driverServiceAreas).where(eq(driverServiceAreas.driverId, driverId));
      await tx.insert(driverServiceAreas).values(s.states.map((stateCode) => ({ driverId, stateCode })));

      const prefs = {
        isBookable: true,
        tripTypes: s.tripTypes,
        vehicleTypes: ['hatchback', 'sedan', 'suv', 'muv'] as ('hatchback' | 'sedan' | 'suv' | 'muv')[],
        transmissions: s.transmissions,
      };
      await tx.insert(driverPreferences).values({ driverId, ...prefs }).onConflictDoUpdate({ target: driverPreferences.driverId, set: prefs });

      await tx.update(driverRateCards).set({ effectiveTo: now }).where(eq(driverRateCards.driverId, driverId));
      await tx.insert(driverRateCards).values({ driverId, hourlyRateMinor: s.rate * 100, minimumBillableHours: s.minHours, effectiveFrom: now });

      await tx.delete(driverWeeklyAvailability).where(eq(driverWeeklyAvailability.driverId, driverId));
      const [start, end] = s.hours === 'always' ? [0, 24] : s.hours;
      await tx.insert(driverWeeklyAvailability).values(
        Array.from({ length: 7 }, (_, dayOfWeek) => ({ driverId, dayOfWeek, startMinute: start * 60, endMinute: end * 60 })),
      );
    });
    console.log(`  ✓ ${email}  [TEST] ${s.name}  ${s.states.join(',')}  ₹${s.rate}/h`);
  }
  console.log(`Seeded ${SEEDS.length} synthetic drivers. Password: ${process.env.SEED_DRIVER_PASSWORD ? '(from SEED_DRIVER_PASSWORD)' : password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => sqlClient.end());
