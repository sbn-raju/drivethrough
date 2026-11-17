# DriveThrough API

Express 5 + TypeScript + Drizzle ORM on Supabase Postgres.
Covers:
- **Feature 01**: authentication and account management.
- The profile and onboarding endpoints the sign-up flows need (subsets of Features 02 and 03).
- **Feature 05**: location and maps, through the Uber Maps API.
- **Feature 06**: driver search and matching.
- The part of **Feature 04** that matching needs: preferences, rate card, weekly availability and the bookable toggle.

## Setup

```bash
cp .env.example .env      # fill in DATABASE_URL and the three secrets
npm install
npm run db:migrate        # applies drizzle/*.sql to Supabase
npm run dev               # http://localhost:4000
npm test                  # unit tests: state lookup, route-state rules, availability, ranking
npm run db:seed:dev-drivers   # non-production only: synthetic approved drivers for search testing
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

## Maps (Feature 05): Uber Maps API

Set `UBER_CLIENT_ID` and `UBER_CLIENT_SECRET`, for an app with the `maps-apis` and `maps.routing` scopes, in `.env`.

**Credentials**
- The backend gets an app token through the OAuth client-credentials flow and caches it in memory.
- It requests a new token a day before expiry, or after a 401.
- The secret never reaches the browser, so the frontend calls our endpoints, not Uber's.

**Which Uber endpoint does what**

| Need | Uber endpoint | Notes |
|---|---|---|
| Autocomplete | `GET /maps/beta/autocomplete` | Proxied through `GET /locations/suggestions`. Limited to India |
| Place → address, coordinates, state | `GET /maps/beta/details` | The client sends only place ids. The server resolves coordinates |
| Distance and duration | `POST /v2/eta/predict` (CAR) | Current-conditions estimate. Uber has no departure-time input and returns no route geometry |
| Map preview | `POST /maps/beta/staticmap` | Signed image URL with pickup/drop pins and a straight line. Generated per request, not stored |

**Route states.** Uber returns no route line, so states are derived from the pickup/drop coordinates using the bundled boundaries (`data/README.md`). Uber's `FEDERATED_STATE` is a cross-check.

| Status | When | Matching |
|---|---|---|
| `determined` | Pickup and drop are in the same state | Driver must cover that state |
| `approximate` | Interstate. Endpoints plus 5 km samples along the straight line | Driver must cover every state found |
| `uncertain` | An endpoint is unclassified or disagrees with Uber, or more than 25% of the line is outside India (for example a coastal route such as Chennai→Kolkata) | No drivers are shown. The consumer is pointed to support |

**Safety checks**
- If road distance is shorter than the straight line, or implausibly longer, the request fails with `503 MAPS_UNAVAILABLE` instead of using bad data.
- Provider errors and timeouts return a retryable `503 MAPS_UNAVAILABLE`. A 429 returns `503 MAPS_QUOTA`.
- No distance, duration or fare is ever invented.

**Estimates expire** after `ROUTE_ESTIMATE_TTL_MINUTES`. Search then returns `409 ROUTE_ESTIMATE_EXPIRED`, and the client re-estimates.

## Driver matching (Feature 06)

`POST /search/drivers` with `{ routeEstimateId, tripType, pickupAt, returnAt?, vehicleId, language? }`. Times are ISO 8601 with an offset.

**Hard filters** (`src/modules/search/`). All are enforced on the server, before ranking:
1. Active driver account.
2. Approved profile, plus an approved driving licence valid through the trip. Production ignores synthetic (dummy-KYC) licences.
3. Bookable toggle on.
4. Covers every route state, and every route state is enabled in `service_states`.
5. Accepts the trip type, the vehicle type and the transmission.
6. Weekly availability (IST) covers the whole trip, from `PICKUP_BUFFER_MINUTES` before pickup to `TURNAROUND_BUFFER_MINUTES` after it ends.
   - A round trip ends at `returnAt` + the drive time. The return leg is assumed to take as long as the outbound leg.
7. No conflicting confirmed booking. This is a placeholder hook until bookings exist (Feature 08).

**Ranking** (`ranking.ts`, with configurable weights) uses availability slack, relative rate, experience and whether the driver is based in the pickup state. Rating and reliability weights are 0 until Features 08 and 11 exist.

**Results** show a verification badge, never document details. `fareEstimate` is `null` until the fare engine (Feature 07) is built.

## Endpoints added for Features 04–06 (`/api/v1`)

| Method | Path | |
|---|---|---|
| GET | `/reference/states` | Supported states (`service_states`) |
| GET | `/locations/suggestions?q=&context=origin\|destination` | Consumer. Uber autocomplete proxy, 60/min per user |
| POST | `/routes/estimate` | Consumer. `{ pickupPlaceId, dropPlaceId }` → stored estimate |
| GET | `/routes/estimates/:id` · `/routes/estimates/:id/static-map` | Own estimates only |
| POST | `/routes/validate-coverage` | `{ routeEstimateId }` → route states and whether they're served |
| POST | `/search/drivers` | Consumer. See above |
| GET | `/drivers/me/settings` | Preferences, rate card, availability, states, bookable blockers |
| PUT | `/drivers/me/preferences` · `/rate-card` · `/availability` · `/bookable-status` | Rate cards are versioned: a change closes the current row and opens a new one |

**Synthetic drivers:** `npm run db:seed:dev-drivers` creates seven `[TEST]` drivers (`synthetic.driverN@drivethrough.test`), mostly around TG/AP/KA/TN/DL/MH, with approved synthetic documents. It refuses to run when `NODE_ENV=production`.
