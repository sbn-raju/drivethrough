import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import { verificationCodes } from '../../db/schema.js';
import type { Contact } from '../../common/utils/contact.js';
import { generateOtp, hashOtp, safeEqualHex } from '../../common/utils/crypto.js';
import { sendOtp } from '../../services/notifier.js';

type Purpose = 'signup' | 'password_reset' | 'contact_change';

const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 45_000;

const scope = (userId: string, purpose: Purpose, target: string) => `${purpose}:${userId}:${target}`;

/**
 * Issues a single-use, time-limited code. Any earlier unused code for the same purpose is invalidated.
 * Silently skips if a code was sent very recently (resend cooldown).
 */
export async function issueOtp(userId: string, to: Contact, purpose: Purpose) {
  const [latest] = await db
    .select({ createdAt: verificationCodes.createdAt })
    .from(verificationCodes)
    .where(and(eq(verificationCodes.userId, userId), eq(verificationCodes.purpose, purpose)))
    .orderBy(desc(verificationCodes.createdAt))
    .limit(1);
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) return;

  const code = generateOtp();
  await db.transaction(async (tx) => {
    await tx
      .update(verificationCodes)
      .set({ consumedAt: new Date() })
      .where(
        and(eq(verificationCodes.userId, userId), eq(verificationCodes.purpose, purpose), isNull(verificationCodes.consumedAt)),
      );
    await tx.insert(verificationCodes).values({
      userId,
      channel: to.channel,
      target: to.value,
      purpose,
      codeHash: hashOtp(code, scope(userId, purpose, to.value)),
      expiresAt: new Date(Date.now() + env.OTP_TTL_SECONDS * 1000),
    });
  });
  await sendOtp(to, code, purpose);
}

/** Returns true and consumes the code if valid; otherwise records the failed attempt. */
export async function consumeOtp(userId: string, target: string, purpose: Purpose, code: string): Promise<boolean> {
  const [record] = await db
    .select()
    .from(verificationCodes)
    .where(
      and(
        eq(verificationCodes.userId, userId),
        eq(verificationCodes.purpose, purpose),
        eq(verificationCodes.target, target),
        isNull(verificationCodes.consumedAt),
        gt(verificationCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(verificationCodes.createdAt))
    .limit(1);

  if (!record || record.attempts >= MAX_ATTEMPTS) return false;

  if (!safeEqualHex(record.codeHash, hashOtp(code, scope(userId, purpose, target)))) {
    await db
      .update(verificationCodes)
      .set({ attempts: sql`${verificationCodes.attempts} + 1` })
      .where(eq(verificationCodes.id, record.id));
    return false;
  }

  // Conditional update guarantees single use even under concurrent requests.
  const consumed = await db
    .update(verificationCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(verificationCodes.id, record.id), isNull(verificationCodes.consumedAt)))
    .returning({ id: verificationCodes.id });
  return consumed.length === 1;
}
