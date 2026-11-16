# DriveThrough API

Express 5 + TypeScript + Drizzle ORM on Supabase Postgres.
Covers **Feature 01 (authentication and account management)**, plus the profile and onboarding endpoints the sign-up flows need (subsets of Features 02 and 03).

## Setup

```bash
cp .env.example .env      # fill in DATABASE_URL and the three secrets
npm install
npm run db:migrate        # applies drizzle/*.sql to Supabase
npm run dev               # http://localhost:4000
```

**Supabase connection strings:** go to Project Settings → Database → Connection string.
- `DATABASE_URL`: the transaction pooler (port 6543). Prepared statements are turned off, so the pooler works.
- `DATABASE_MIGRATION_URL`: the direct connection or the session pooler (port 5432). drizzle-kit uses it for migrations.

**Schema changes:** edit `src/db/schema.ts`, then run `npm run db:generate` to write a new migration and `npm run db:migrate` to apply it.

**Row Level Security** is enabled on every table and no policies are defined. As a result, Supabase's public REST API (anon/authenticated keys) cannot read or write these tables. All access goes through this API.

**KYC storage (optional in dev):** create a **private** bucket named `driver-documents` in Supabase Storage, then set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- If those are left empty in a non-production environment, uploads are checked and then dropped. The records are saved with `is_synthetic = true` (dummy KYC) and show a "Synthetic (test)" label.
- In production, uploads are refused until storage is configured.

**OTP delivery:** no SMS or email provider is connected yet.
- In a non-production environment, codes are printed to the server console (`[dev-notifier] code: 123456`).
- In production, sending a code throws an error until a provider is added in `src/services/notifier.ts`.

## Auth design

| Concern | Implementation |
|---|---|
| Passwords | Argon2id (`@node-rs/argon2`, OWASP parameters) |
| Access token | HS256 JWT, 15 min, held in memory by the client and sent as `Authorization: Bearer` |
| Refresh token | Opaque random token in an `httpOnly`, `SameSite=Strict` cookie scoped to `/api/v1/auth`. Only its SHA-256 is stored |
| Rotation | Every refresh issues a new token and revokes the old one. If a rotated token is presented again, every session for that user is revoked (reuse detection) |
| Revocation | Each request checks the session row, so logout, logout-all, password reset and deactivation take effect immediately |
| OTP | 6 digits, HMAC-peppered hash, 10-minute expiry, single use, at most 5 attempts, 45-second resend cooldown |
| Enumeration | Register, forgot-password and resend return the same response whether or not the account exists. Login uses a dummy hash so timing is constant |
| CSRF | Cookie endpoints require `X-Requested-With: drivethrough-web`, and CORS is strict |
| Rate limits | Per IP, and per IP + identifier, on register, login, OTP, recovery and refresh (in-memory store; switch to Redis when running more than one instance) |
| Roles | `consumer` / `driver` can be chosen at sign-up. `admin` / `super_admin` can never be self-assigned. `requireRole` guards every module |
| KYC numbers | AES-256-GCM encrypted. Only the last 4 digits are ever returned |
| Audit | `audit_logs` records auth events and document uploads. Secrets are never logged |

The frontend should be served from the same site as the API (the Vite dev proxy does this) so the `SameSite=Strict` refresh cookie is sent.

## Endpoints (`/api/v1`)

| Method | Path | |
|---|---|---|
| POST | `/auth/register` | `{ role, email?, phone?, password }` → 202, sends a code |
| POST | `/auth/verify-otp` | `{ identifier, code }` → activates the account and signs in |
| POST | `/auth/resend-otp` | `{ identifier, purpose: signup \| password_reset }` |
| POST | `/auth/login` | `{ identifier, password }`. Returns 403 `VERIFICATION_REQUIRED` if the account is unverified |
| POST | `/auth/refresh` | cookie → new access token, rotated cookie |
| POST | `/auth/logout` · `/auth/logout-all` | revoke the current session or all sessions |
| POST | `/auth/forgot-password` · `/auth/reset-password` | code-based recovery. A reset revokes all sessions |
| GET | `/auth/me` · `/auth/sessions` | current user + onboarding state · active sessions |
| GET/PATCH | `/consumers/me` | consumer profile |
| PUT | `/consumers/me/emergency-contact` | |
| GET/POST/PATCH/DELETE | `/consumers/me/vehicles[/:id]` | DELETE deactivates the vehicle |
| POST | `/consumers/me/onboarding/complete` | |
| GET | `/drivers/me/onboarding` | profile, documents, service areas, checklist |
| PATCH | `/drivers/me/profile` | |
| POST | `/drivers/me/profile-photo` | multipart `file` |
| POST | `/drivers/me/documents/driving-licence` · `/identity-proof` | multipart: fields + `file` |
| GET | `/drivers/me/documents` | |
| PUT | `/drivers/me/service-areas` | `{ stateCodes: ["KA", …] }` |
| POST | `/drivers/me/submit` | moves the driver to `pending_review`. Approval is reviewer-only |
