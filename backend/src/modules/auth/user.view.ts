import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { consumerProfiles, driverProfiles, type User } from '../../db/schema.js';

export type OnboardingSummary =
  | { kind: 'consumer'; completed: boolean; fullName: string | null }
  | { kind: 'driver'; completed: boolean; fullName: string | null; approvalStatus: string }
  | { kind: 'staff'; completed: true; fullName: null };

async function onboardingFor(user: User): Promise<OnboardingSummary> {
  if (user.role === 'consumer') {
    const [p] = await db.select().from(consumerProfiles).where(eq(consumerProfiles.userId, user.id)).limit(1);
    return { kind: 'consumer', completed: !!p?.onboardingCompletedAt, fullName: p?.fullName ?? null };
  }
  if (user.role === 'driver') {
    const [p] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, user.id)).limit(1);
    const approvalStatus = p?.approvalStatus ?? 'not_submitted';
    // Profile *submission* completes onboarding; it is not the same as verification approval.
    return {
      kind: 'driver',
      completed: approvalStatus !== 'not_submitted' && approvalStatus !== 'needs_resubmission',
      fullName: p?.fullName ?? null,
      approvalStatus,
    };
  }
  return { kind: 'staff', completed: true, fullName: null };
}

export async function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    accountStatus: user.accountStatus,
    emailVerified: !!user.emailVerifiedAt,
    phoneVerified: !!user.phoneVerifiedAt,
    onboarding: await onboardingFor(user),
  };
}
