import type { Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

const message = { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a few minutes and try again.' } };

/** Key by IP and (when present) the submitted identifier, so one attacker can't lock everyone out. */
const ipAndIdentifier = (req: Request) => {
  const ip = ipKeyGenerator(req.ip ?? '');
  const id = typeof req.body?.identifier === 'string' ? req.body.identifier.trim().toLowerCase() : '';
  return `${ip}|${id}`;
};

const make = (windowMinutes: number, limit: number, byIdentifier = false) =>
  rateLimit({
    windowMs: windowMinutes * 60_000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message,
    ...(byIdentifier ? { keyGenerator: ipAndIdentifier } : {}),
  });

// NOTE: the in-memory store is per-process. Use a shared store (e.g. Redis) when running >1 instance.
export const authLimiters = {
  register: make(60, 10),
  login: make(15, 10, true),
  verifyOtp: make(15, 10, true),
  resendOtp: make(15, 5, true),
  forgotPassword: make(60, 5, true),
  resetPassword: make(15, 10, true),
  refresh: make(15, 60),
};

export const generalLimiter = make(1, 120);

/**
 * Per signed-in user limits for endpoints that spend third-party quota (maps) or are expensive (search).
 * Must run after requireAuth.
 */
const byUser = (windowMinutes: number, limit: number) =>
  rateLimit({
    windowMs: windowMinutes * 60_000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' } },
    keyGenerator: (req) => `user:${req.user?.id ?? ipKeyGenerator(req.ip ?? '')}`,
  });

export const mapsLimiters = {
  suggestions: byUser(1, 60),
  estimate: byUser(15, 40),
  staticMap: byUser(15, 40),
  search: byUser(15, 60),
};
