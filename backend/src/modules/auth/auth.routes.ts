import { Router, type Request } from 'express';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { consumerProfiles, driverProfiles, userSessions, users, type User } from '../../db/schema.js';
import { AppError, badRequest, unauthorized } from '../../common/errors/app-error.js';
import { requireAuth, requireCsrfHeader } from '../../common/middleware/auth.js';
import { authLimiters } from '../../common/middleware/rate-limit.js';
import { parse } from '../../common/middleware/validate.js';
import { maskContact, type Contact } from '../../common/utils/contact.js';
import { sha256 } from '../../common/utils/crypto.js';
import { getDummyHash, hashPassword, verifyPassword } from '../../common/utils/password.js';
import { audit } from '../../services/audit.js';
import { sendAccountExistsNotice } from '../../services/notifier.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendOtpSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from './auth.schemas.js';
import { consumeOtp, issueOtp } from './otp.service.js';
import {
  REFRESH_COOKIE,
  buildAuthResponse,
  clearRefreshCookie,
  createSession,
  revokeAllSessions,
} from './session.service.js';
import { toPublicUser } from './user.view.js';

export const authRouter = Router();

const INVALID_CODE = 'That code is invalid or has expired. Request a new code and try again.';
const INVALID_LOGIN = 'Incorrect email/mobile number or password.';

const findUserByContact = async (c: Contact) => {
  const [user] = await db
    .select()
    .from(users)
    .where(c.channel === 'email' ? eq(users.email, c.value) : eq(users.phone, c.value))
    .limit(1);
  return user as User | undefined;
};

const isContactVerified = (user: User, c: Contact) =>
  c.channel === 'email' ? !!user.emailVerifiedAt : !!user.phoneVerifiedAt;

/** Identical response for new and existing contacts, so registration can't be used to enumerate accounts. */
const verificationSentResponse = (c: Contact) => ({
  message: 'We sent a 6-digit verification code. It expires in 10 minutes.',
  verification: { identifier: c.value, channel: c.channel, destination: maskContact(c) },
});

const isUniqueViolation = (err: unknown) =>
  typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === '23505';

// ---------------------------------------------------------------------------
// POST /auth/register — AUTH-001
// ---------------------------------------------------------------------------
authRouter.post('/register', authLimiters.register, async (req, res) => {
  const input = parse(registerSchema, req.body);
  const primary: Contact = input.email
    ? { channel: 'email', value: input.email }
    : { channel: 'phone', value: input.phone! };

  const contactMatch = [];
  if (input.email) contactMatch.push(eq(users.email, input.email));
  if (input.phone) contactMatch.push(eq(users.phone, input.phone));
  const matches = await db.select().from(users).where(or(...contactMatch));

  const passwordHash = await hashPassword(input.password);
  let user: User | undefined;

  if (matches.length === 0) {
    try {
      [user] = await db
        .insert(users)
        .values({ role: input.role, email: input.email, phone: input.phone, passwordHash })
        .returning();
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  } else if (matches.length === 1 && matches[0].accountStatus === 'pending_verification') {
    // Unverified sign-up being retried: refresh credentials and re-send the code.
    [user] = await db
      .update(users)
      .set({ role: input.role, email: input.email ?? null, phone: input.phone ?? null, passwordHash })
      .where(eq(users.id, matches[0].id))
      .returning();
  } else {
    await sendAccountExistsNotice(primary);
    await audit(req, 'auth.register.duplicate', { metadata: { channel: primary.channel } });
  }

  if (user) {
    await issueOtp(user.id, primary, 'signup');
    await audit(req, 'auth.register', { actorUserId: user.id, entityType: 'user', entityId: user.id });
  }

  res.status(202).json(verificationSentResponse(primary));
});

// ---------------------------------------------------------------------------
// POST /auth/verify-otp — AUTH-002 (activates the account and signs the user in)
// ---------------------------------------------------------------------------
authRouter.post('/verify-otp', authLimiters.verifyOtp, async (req, res) => {
  const { identifier, code } = parse(verifyOtpSchema, req.body);
  const user = await findUserByContact(identifier);
  if (!user || user.accountStatus !== 'pending_verification') throw badRequest(INVALID_CODE, 'OTP_INVALID');

  const ok = await consumeOtp(user.id, identifier.value, 'signup', code);
  if (!ok) throw badRequest(INVALID_CODE, 'OTP_INVALID');

  const now = new Date();
  const { activated, session } = await db.transaction(async (tx) => {
    const [activated] = await tx
      .update(users)
      .set({
        accountStatus: 'active',
        lastLoginAt: now,
        ...(identifier.channel === 'email' ? { emailVerifiedAt: now } : { phoneVerifiedAt: now }),
      })
      .where(eq(users.id, user.id))
      .returning();

    if (activated.role === 'consumer') {
      await tx.insert(consumerProfiles).values({ userId: user.id }).onConflictDoNothing();
    } else if (activated.role === 'driver') {
      await tx.insert(driverProfiles).values({ userId: user.id }).onConflictDoNothing();
    }

    const session = await createSession(tx, user.id, req);
    return { activated, session };
  });

  await audit(req, 'auth.verify', { actorUserId: user.id, entityType: 'user', entityId: user.id });
  res.json(await buildAuthResponse(res, activated, session));
});

// ---------------------------------------------------------------------------
// POST /auth/resend-otp
// ---------------------------------------------------------------------------
authRouter.post('/resend-otp', authLimiters.resendOtp, async (req, res) => {
  const { identifier, purpose } = parse(resendOtpSchema, req.body);
  const user = await findUserByContact(identifier);

  if (user) {
    if (purpose === 'signup' && user.accountStatus === 'pending_verification') {
      await issueOtp(user.id, identifier, 'signup');
    } else if (
      purpose === 'password_reset' &&
      (user.accountStatus === 'active' || user.accountStatus === 'suspended') &&
      isContactVerified(user, identifier)
    ) {
      await issueOtp(user.id, identifier, 'password_reset');
    }
  }
  res.status(202).json(verificationSentResponse(identifier));
});

// ---------------------------------------------------------------------------
// POST /auth/login — AUTH-003
// ---------------------------------------------------------------------------
authRouter.post('/login', authLimiters.login, async (req, res) => {
  const { identifier, password } = parse(loginSchema, req.body);
  const user = await findUserByContact(identifier);

  // Always run a hash verification so response time doesn't reveal whether the account exists.
  const valid = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);

  if (!user || !user.passwordHash || !valid || user.accountStatus === 'deactivated') {
    await audit(req, 'auth.login.failed', { actorUserId: user?.id ?? null });
    throw unauthorized(INVALID_LOGIN, 'INVALID_CREDENTIALS');
  }

  if (user.accountStatus === 'pending_verification') {
    await issueOtp(user.id, identifier, 'signup');
    throw new AppError(403, 'VERIFICATION_REQUIRED', 'Verify your account to continue. We sent you a new code.', {
      verification: verificationSentResponse(identifier).verification,
    });
  }

  // Suspended accounts may sign in (to view status / contact support) but restricted actions are blocked.
  const [updated] = await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id)).returning();
  const session = await createSession(db, user.id, req);
  await audit(req, 'auth.login', { actorUserId: user.id, entityType: 'session', entityId: session.sessionId });
  res.json(await buildAuthResponse(res, updated, session));
});

// ---------------------------------------------------------------------------
// POST /auth/refresh — AUTH-004 (rotating refresh tokens with reuse detection)
// ---------------------------------------------------------------------------
authRouter.post('/refresh', authLimiters.refresh, requireCsrfHeader, async (req: Request, res) => {
  const token: string | undefined = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw unauthorized('Please sign in to continue.', 'NO_SESSION');

  const [current] = await db
    .select()
    .from(userSessions)
    .where(eq(userSessions.refreshTokenHash, sha256(token)))
    .limit(1);

  if (!current) {
    clearRefreshCookie(res);
    throw unauthorized('Please sign in to continue.', 'NO_SESSION');
  }

  if (current.revokedAt) {
    if (current.replacedBySessionId) {
      // A rotated token was presented again: assume theft and end every session for this user.
      await revokeAllSessions(current.userId);
      await audit(req, 'auth.refresh.reuse_detected', { actorUserId: current.userId, entityId: current.id, entityType: 'session' });
    }
    clearRefreshCookie(res);
    throw unauthorized('Your session has ended. Please sign in again.', 'SESSION_REVOKED');
  }

  if (current.expiresAt <= new Date()) {
    clearRefreshCookie(res);
    throw unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED');
  }

  const [user] = await db.select().from(users).where(eq(users.id, current.userId)).limit(1);
  if (!user || user.accountStatus === 'deactivated' || user.accountStatus === 'pending_verification') {
    clearRefreshCookie(res);
    throw unauthorized();
  }

  const next = await db.transaction(async (tx) => {
    const session = await createSession(tx, user.id, req);
    const revoked = await tx
      .update(userSessions)
      .set({ revokedAt: new Date(), replacedBySessionId: session.sessionId, lastUsedAt: new Date() })
      .where(and(eq(userSessions.id, current.id), isNull(userSessions.revokedAt)))
      .returning({ id: userSessions.id });
    if (revoked.length === 0) throw unauthorized('Your session has ended. Please sign in again.', 'SESSION_REVOKED');
    return session;
  });

  res.json(await buildAuthResponse(res, user, next));
});

// ---------------------------------------------------------------------------
// POST /auth/logout and /auth/logout-all — AUTH-006
// ---------------------------------------------------------------------------
authRouter.post('/logout', requireCsrfHeader, async (req, res) => {
  const token: string | undefined = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    const [s] = await db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(userSessions.refreshTokenHash, sha256(token)), isNull(userSessions.revokedAt)))
      .returning({ id: userSessions.id, userId: userSessions.userId });
    if (s) await audit(req, 'auth.logout', { actorUserId: s.userId, entityType: 'session', entityId: s.id });
  }
  clearRefreshCookie(res);
  res.status(204).end();
});

authRouter.post('/logout-all', requireCsrfHeader, requireAuth, async (req, res) => {
  await revokeAllSessions(req.user!.id);
  await audit(req, 'auth.logout_all', { actorUserId: req.user!.id });
  clearRefreshCookie(res);
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// POST /auth/forgot-password and /auth/reset-password — AUTH-007
// ---------------------------------------------------------------------------
authRouter.post('/forgot-password', authLimiters.forgotPassword, async (req, res) => {
  const { identifier } = parse(forgotPasswordSchema, req.body);
  const user = await findUserByContact(identifier);
  if (
    user &&
    (user.accountStatus === 'active' || user.accountStatus === 'suspended') &&
    isContactVerified(user, identifier)
  ) {
    await issueOtp(user.id, identifier, 'password_reset');
    await audit(req, 'auth.password_reset.requested', { actorUserId: user.id });
  }
  res.status(202).json({
    message: 'If an account matches, we sent a code to reset your password.',
    verification: verificationSentResponse(identifier).verification,
  });
});

authRouter.post('/reset-password', authLimiters.resetPassword, async (req, res) => {
  const { identifier, code, newPassword } = parse(resetPasswordSchema, req.body);
  const user = await findUserByContact(identifier);
  if (!user || (user.accountStatus !== 'active' && user.accountStatus !== 'suspended')) {
    throw badRequest(INVALID_CODE, 'OTP_INVALID');
  }
  const ok = await consumeOtp(user.id, identifier.value, 'password_reset', code);
  if (!ok) throw badRequest(INVALID_CODE, 'OTP_INVALID');

  await db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, user.id));
  await revokeAllSessions(user.id); // a password reset ends every existing session
  await audit(req, 'auth.password_reset.completed', { actorUserId: user.id });
  res.json({ message: 'Your password has been reset. Sign in with your new password.' });
});

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------
authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ user: await toPublicUser(req.user!) });
});

// GET /auth/sessions — list own active sessions (supports AUTH-006 UX)
authRouter.get('/sessions', requireAuth, async (req, res) => {
  const sessions = await db
    .select({
      id: userSessions.id,
      createdAt: userSessions.createdAt,
      expiresAt: userSessions.expiresAt,
      deviceMetadata: userSessions.deviceMetadata,
    })
    .from(userSessions)
    .where(and(eq(userSessions.userId, req.user!.id), isNull(userSessions.revokedAt), gt(userSessions.expiresAt, new Date())));
  res.json({ sessions: sessions.map((s) => ({ ...s, current: s.id === req.sessionId })) });
});

