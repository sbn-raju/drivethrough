import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  inet,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/*
 * DriveThrough data model — Feature 01 (auth), the profile/onboarding tables from
 * Features 02 and 03, the matching subset of Feature 04 (preferences, rate cards,
 * weekly availability) and Feature 05 (route estimates).
 *
 * Conventions (Feature 14): UUID primary keys, UTC timestamps (timestamptz),
 * migrations for every schema change. RLS is enabled on every table with no
 * policies, so Supabase's auto-generated REST API cannot read them; all access
 * goes through the Express API using the server-side connection.
 */

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRole = pgEnum('user_role', ['consumer', 'driver', 'admin', 'super_admin']);
export const accountStatus = pgEnum('account_status', [
  'pending_verification',
  'active',
  'suspended',
  'deactivated',
]);
export const contactChannel = pgEnum('contact_channel', ['email', 'phone']);
export const otpPurpose = pgEnum('otp_purpose', ['signup', 'password_reset', 'contact_change']);

export const identityStatus = pgEnum('identity_status', ['not_started', 'pending', 'verified', 'rejected']);
export const vehicleType = pgEnum('vehicle_type', [
  'hatchback',
  'sedan',
  'suv',
  'muv',
  'luxury',
  'van',
  'pickup',
  'other',
]);
export const transmission = pgEnum('transmission', ['manual', 'automatic']);
export const fuelType = pgEnum('fuel_type', ['petrol', 'diesel', 'cng', 'electric', 'hybrid', 'other']);
export const vehicleStatus = pgEnum('vehicle_status', ['active', 'inactive']);

export const driverApprovalStatus = pgEnum('driver_approval_status', [
  'not_submitted',
  'pending_review',
  'needs_resubmission',
  'approved',
  'rejected',
  'expired',
  'suspended',
]);
export const driverDocumentType = pgEnum('driver_document_type', [
  'driving_licence',
  'identity_proof',
  'address_proof',
]);
export const documentVerificationStatus = pgEnum('document_verification_status', [
  'submitted',
  'pending_review',
  'needs_resubmission',
  'approved',
  'rejected',
  'expired',
]);

// ---------------------------------------------------------------------------
// Feature 01 — Authentication and account management
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Stored lower-cased. */
    email: text('email'),
    /** Stored in E.164 format, e.g. +919876543210. */
    phone: text('phone'),
    passwordHash: text('password_hash'),
    role: userRole('role').notNull(),
    accountStatus: accountStatus('account_status').notNull().default('pending_verification'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('users_email_unique').on(t.email),
    uniqueIndex('users_phone_unique').on(t.phone),
    index('users_role_status_idx').on(t.role, t.accountStatus),
  ],
).enableRLS();

export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 of the opaque refresh token. The token itself is never stored. */
    refreshTokenHash: text('refresh_token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    /** Set when this session's token was rotated; used for refresh-token reuse detection. */
    replacedBySessionId: uuid('replaced_by_session_id'),
    deviceMetadata: jsonb('device_metadata').$type<{ userAgent?: string; ip?: string }>(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('user_sessions_token_hash_unique').on(t.refreshTokenHash),
    index('user_sessions_user_idx').on(t.userId),
  ],
).enableRLS();

/** One-time codes for contact verification and account recovery. Only hashes are stored. */
export const verificationCodes = pgTable(
  'verification_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: contactChannel('channel').notNull(),
    target: text('target').notNull(),
    purpose: otpPurpose('purpose').notNull(),
    codeHash: text('code_hash').notNull(),
    attempts: smallint('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('verification_codes_lookup_idx').on(t.userId, t.purpose, t.createdAt)],
).enableRLS();

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ipAddress: inet('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_actor_idx').on(t.actorUserId, t.createdAt),
    index('audit_logs_entity_idx').on(t.entityType, t.entityId),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Feature 02 — Consumer profile and vehicles (onboarding subset)
// ---------------------------------------------------------------------------

export const consumerProfiles = pgTable('consumer_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  fullName: text('full_name'),
  address: text('address'),
  city: text('city'),
  profilePhotoKey: text('profile_photo_key'),
  identityStatus: identityStatus('identity_status').notNull().default('not_started'),
  emergencyContactName: text('emergency_contact_name'),
  emergencyContactPhone: text('emergency_contact_phone'),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  ...timestamps,
}).enableRLS();

export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    consumerId: uuid('consumer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    make: text('make').notNull(),
    model: text('model').notNull(),
    vehicleType: vehicleType('vehicle_type').notNull(),
    transmission: transmission('transmission').notNull(),
    fuelType: fuelType('fuel_type'),
    registrationReference: text('registration_reference'),
    notes: text('notes'),
    status: vehicleStatus('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [index('vehicles_consumer_status_idx').on(t.consumerId, t.status)],
).enableRLS();

// ---------------------------------------------------------------------------
// Feature 03 — Driver onboarding and KYC
// ---------------------------------------------------------------------------

export const driverProfiles = pgTable(
  'driver_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    fullName: text('full_name'),
    dateOfBirth: date('date_of_birth'),
    homeCity: text('home_city'),
    homeState: text('home_state'),
    profilePhotoKey: text('profile_photo_key'),
    bio: text('bio'),
    experienceYears: smallint('experience_years'),
    languages: text('languages')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** Only an authorised reviewer may move this past `pending_review`. */
    approvalStatus: driverApprovalStatus('approval_status').notNull().default('not_submitted'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewReason: text('review_reason'),
    ...timestamps,
  },
  (t) => [index('driver_profiles_approval_idx').on(t.approvalStatus)],
).enableRLS();

export const driverDocuments = pgTable(
  'driver_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    documentType: driverDocumentType('document_type').notNull(),
    /** e.g. "aadhaar", "passport" for identity proofs. */
    documentSubtype: text('document_subtype'),
    /** Private storage object key — never a public URL. */
    storageKey: text('storage_key').notNull(),
    fileName: text('file_name'),
    mimeType: text('mime_type'),
    sizeBytes: integer('size_bytes'),
    verificationStatus: documentVerificationStatus('verification_status').notNull().default('submitted'),
    /** AES-256-GCM ciphertext. */
    documentNumberEncrypted: text('document_number_encrypted'),
    documentNumberLast4: text('document_number_last4'),
    issuingAuthority: text('issuing_authority'),
    issueDate: date('issue_date'),
    expiryDate: date('expiry_date'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    /** Dummy-KYC record (non-production only). Must never be approved in production. */
    isSynthetic: boolean('is_synthetic').notNull().default(false),
    reviewerId: uuid('reviewer_id').references(() => users.id, { onDelete: 'set null' }),
    reviewReason: text('review_reason'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('driver_documents_driver_type_unique').on(t.driverId, t.documentType),
    index('driver_documents_status_idx').on(t.verificationStatus),
  ],
).enableRLS();

export const driverServiceAreas = pgTable(
  'driver_service_areas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    stateCode: text('state_code').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('driver_service_areas_unique').on(t.driverId, t.stateCode),
    index('driver_service_areas_state_idx').on(t.stateCode),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Reference data — supported states (Feature 04 §3: centrally managed, not hard-coded in the frontend)
// ---------------------------------------------------------------------------

export const tripType = pgEnum('trip_type', ['one_way', 'round_trip']);
/**
 * How confident we are about which states a route passes through (Feature 05 MAP-005):
 * - determined: pickup and drop are in the same state.
 * - approximate: interstate — states taken from the endpoints plus the straight line between them,
 *   because the maps provider (Uber) returns no road geometry.
 * - uncertain: a point could not be classified; matching must not assume eligibility.
 */
export const routeCoverageStatus = pgEnum('route_coverage_status', ['determined', 'approximate', 'uncertain']);

/** States/UTs the platform knows about. `is_enabled` = we operate there (admin-managed in Feature 12). */
export const serviceStates = pgTable('service_states', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  ...timestamps,
}).enableRLS();

// ---------------------------------------------------------------------------
// Feature 04 (matching subset) — preferences, rate cards, weekly availability
// ---------------------------------------------------------------------------

export const driverPreferences = pgTable(
  'driver_preferences',
  {
    driverId: uuid('driver_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Bookable toggle (PREF-008). Only an approved, active driver with a complete setup can turn it on. */
    isBookable: boolean('is_bookable').notNull().default(false),
    tripTypes: tripType('trip_types')
      .array()
      .notNull()
      .default(sql`'{}'`),
    vehicleTypes: vehicleType('vehicle_types')
      .array()
      .notNull()
      .default(sql`'{}'`),
    transmissions: transmission('transmissions')
      .array()
      .notNull()
      .default(sql`'{}'`),
    ...timestamps,
  },
  (t) => [index('driver_preferences_bookable_idx').on(t.driverId).where(sql`${t.isBookable}`)],
).enableRLS();

/**
 * Versioned rate cards. A change closes the current row (`effective_to`) and opens a new one, so
 * quotes (Feature 07) can snapshot the version they used and old quotes are never rewritten.
 */
export const driverRateCards = pgTable(
  'driver_rate_cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    currency: text('currency').notNull().default('INR'),
    /** Integer minor units (paise). */
    hourlyRateMinor: integer('hourly_rate_minor').notNull(),
    minimumBillableHours: smallint('minimum_billable_hours').notNull(),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('driver_rate_cards_current_unique').on(t.driverId).where(sql`${t.effectiveTo} is null`),
    index('driver_rate_cards_driver_idx').on(t.driverId, t.effectiveFrom),
    check('driver_rate_cards_rate_positive', sql`${t.hourlyRateMinor} > 0`),
    check('driver_rate_cards_min_hours_positive', sql`${t.minimumBillableHours} > 0`),
  ],
).enableRLS();

/**
 * Recurring weekly availability in market-local time (IST). Minutes from local midnight;
 * `end_minute = 1440` means "until midnight". Windows never cross midnight — split them per day.
 * One-off blocked periods (`driver_availability`) are the rest of Feature 04.
 */
export const driverWeeklyAvailability = pgTable(
  'driver_weekly_availability',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 0 = Sunday … 6 = Saturday. */
    dayOfWeek: smallint('day_of_week').notNull(),
    startMinute: smallint('start_minute').notNull(),
    endMinute: smallint('end_minute').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('driver_weekly_availability_driver_idx').on(t.driverId, t.dayOfWeek),
    check('driver_weekly_availability_day', sql`${t.dayOfWeek} between 0 and 6`),
    check(
      'driver_weekly_availability_window',
      sql`${t.startMinute} >= 0 and ${t.endMinute} <= 1440 and ${t.startMinute} < ${t.endMinute}`,
    ),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Feature 05 — Route estimates (server-calculated via Uber Maps; never trusted from the client)
// ---------------------------------------------------------------------------

export type ResolvedPlace = {
  placeId: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  /** From the bundled state-boundary polygons, not from free-text address components. */
  stateCode: string | null;
};

export const routeEstimates = pgTable(
  'route_estimates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    consumerId: uuid('consumer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pickup: jsonb('pickup').$type<ResolvedPlace>().notNull(),
    drop: jsonb('drop').$type<ResolvedPlace>().notNull(),
    distanceMeters: integer('distance_meters').notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    /** States the route is taken to pass through, pickup state first. See `coverage_status`. */
    routeStateCodes: text('route_state_codes').array().notNull(),
    coverageStatus: routeCoverageStatus('coverage_status').notNull(),
    /** e.g. "endpoints", "endpoints+straight_line" — recorded so matching decisions can be audited. */
    routeStateMethod: text('route_state_method').notNull(),
    provider: text('provider').notNull(),
    providerMetadata: jsonb('provider_metadata').$type<Record<string, unknown>>(),
    estimatedAt: timestamp('estimated_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('route_estimates_consumer_idx').on(t.consumerId, t.estimatedAt),
    check('route_estimates_distance_positive', sql`${t.distanceMeters} > 0`),
    check('route_estimates_duration_positive', sql`${t.durationSeconds} > 0`),
  ],
).enableRLS();

export type User = typeof users.$inferSelect;
export type UserRole = (typeof userRole.enumValues)[number];
export type DriverDocument = typeof driverDocuments.$inferSelect;
export type TripType = (typeof tripType.enumValues)[number];
export type RouteEstimate = typeof routeEstimates.$inferSelect;
