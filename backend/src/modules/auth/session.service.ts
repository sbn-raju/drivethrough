import type { CookieOptions, Request, Response } from 'express';
import { and, eq, isNull } from 'drizzle-orm';
import { env, isProduction } from '../../config/env.js';
import { db, type Tx } from '../../db/index.js';
import { userSessions, type User } from '../../db/schema.js';
import { signAccessToken } from '../../common/middleware/auth.js';
import { randomToken, sha256 } from '../../common/utils/crypto.js';
import { toPublicUser } from './user.view.js';

export const REFRESH_COOKIE = 'dt_rt';

const cookieOptions = (expires?: Date): CookieOptions => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  path: '/api/v1/auth',
  ...(expires ? { expires } : {}),
});

export const setRefreshCookie = (res: Response, token: string, expires: Date) =>
  res.cookie(REFRESH_COOKIE, token, cookieOptions(expires));

export const clearRefreshCookie = (res: Response) => res.clearCookie(REFRESH_COOKIE, cookieOptions());

const deviceMetadata = (req: Request) => ({
  userAgent: req.get('user-agent')?.slice(0, 256),
  ip: req.ip,
});

export async function createSession(executor: Tx | typeof db, userId: string, req: Request) {
  const refreshToken = randomToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  const [session] = await executor
    .insert(userSessions)
    .values({ userId, refreshTokenHash: sha256(refreshToken), expiresAt, deviceMetadata: deviceMetadata(req) })
    .returning({ id: userSessions.id });
  return { sessionId: session.id, refreshToken, expiresAt };
}

/** Sets the refresh cookie and returns the JSON auth payload (short-lived access token + user). */
export async function buildAuthResponse(
  res: Response,
  user: User,
  session: { sessionId: string; refreshToken: string; expiresAt: Date },
) {
  setRefreshCookie(res, session.refreshToken, session.expiresAt);
  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role, sid: session.sessionId }),
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    user: await toPublicUser(user),
  };
}

export const revokeAllSessions = (userId: string) =>
  db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));
