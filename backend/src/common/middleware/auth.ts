import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import { users, userSessions, type User, type UserRole } from '../../db/schema.js';
import { forbidden, unauthorized } from '../errors/app-error.js';

export type AccessTokenPayload = { sub: string; role: UserRole; sid: string };

declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
    }
  }
}

export const signAccessToken = (payload: AccessTokenPayload) =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    issuer: 'drivethrough-api',
    audience: 'drivethrough-web',
  });

/**
 * Verifies the Bearer access token, then confirms the session is still live and the account
 * still exists — so logout / logout-all / suspension take effect immediately.
 */
export const requireAuth: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();

  let payload: AccessTokenPayload;
  try {
    payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: 'drivethrough-api',
      audience: 'drivethrough-web',
    }) as AccessTokenPayload;
  } catch {
    throw unauthorized('Your session has expired. Please sign in again.', 'TOKEN_INVALID');
  }

  const [row] = await db
    .select({ user: users })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(
      and(
        eq(userSessions.id, payload.sid),
        eq(userSessions.userId, payload.sub),
        isNull(userSessions.revokedAt),
        gt(userSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row || row.user.accountStatus === 'deactivated') {
    throw unauthorized('Your session has ended. Please sign in again.', 'SESSION_REVOKED');
  }

  req.user = row.user;
  req.sessionId = payload.sid;
  next();
};

/** Role-based authorisation (AUTH-005). Must run after requireAuth. */
export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) throw forbidden();
    next();
  };

/** Suspended or unverified accounts cannot perform restricted actions. */
export const requireActiveAccount: RequestHandler = (req, _res, next) => {
  if (req.user?.accountStatus !== 'active') {
    throw forbidden('Your account is not active. Contact support for help.', 'ACCOUNT_NOT_ACTIVE');
  }
  next();
};

/**
 * CSRF guard for cookie-authenticated endpoints (refresh / logout). Browsers cannot attach a custom
 * header to a cross-site request without a CORS preflight, which our strict CORS policy rejects.
 */
export const requireCsrfHeader: RequestHandler = (req, _res, next) => {
  if (req.get('x-requested-with') !== 'drivethrough-web') throw forbidden('Missing CSRF header.', 'CSRF');
  next();
};
