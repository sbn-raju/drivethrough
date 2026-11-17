import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  OTP_PEPPER: z.string().min(32, 'OTP_PEPPER must be at least 32 characters'),
  DATA_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded'),

  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(600),

  SUPABASE_URL: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal('').transform(() => undefined)),
  SUPABASE_KYC_BUCKET: z.string().default('driver-documents'),

  // Feature 05 — Uber Maps API (places, ETA, static maps). OAuth client credentials; server-side only.
  // The client secret must never reach the browser — all map calls go through this API.
  UBER_CLIENT_ID: z.string().optional().or(z.literal('').transform(() => undefined)),
  UBER_CLIENT_SECRET: z.string().optional().or(z.literal('').transform(() => undefined)),
  UBER_API_BASE_URL: z.string().url().default('https://api.uber.com'),
  UBER_AUTH_URL: z.string().url().default('https://auth.uber.com/oauth/v2/token'),
  /** Value for the `X-Uber-Origin` header Uber requires on ETA requests (identifies the use case). */
  UBER_ETA_ORIGIN: z.string().default('DriveThrough trip estimate'),
  MAPS_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  ROUTE_ESTIMATE_TTL_MINUTES: z.coerce.number().int().positive().default(30),

  // Feature 04 / 06 — marketplace rules. Admin-managed configuration arrives with Feature 12.
  RATE_HOURLY_MIN_INR: z.coerce.number().int().positive().default(100),
  RATE_HOURLY_MAX_INR: z.coerce.number().int().positive().default(2000),
  RATE_MIN_HOURS_MIN: z.coerce.number().int().positive().default(1),
  RATE_MIN_HOURS_MAX: z.coerce.number().int().positive().default(12),
  PICKUP_BUFFER_MINUTES: z.coerce.number().int().min(0).default(60),
  TURNAROUND_BUFFER_MINUTES: z.coerce.number().int().min(0).default(60),
  SEARCH_MIN_LEAD_MINUTES: z.coerce.number().int().min(0).default(120),
  SEARCH_MAX_ADVANCE_DAYS: z.coerce.number().int().positive().default(60),
  ROUND_TRIP_MAX_DAYS: z.coerce.number().int().positive().default(7),
  /** Market time zone offset in minutes. India (IST) is a fixed UTC+05:30 with no daylight saving. */
  MARKET_UTC_OFFSET_MINUTES: z.coerce.number().int().default(330),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
