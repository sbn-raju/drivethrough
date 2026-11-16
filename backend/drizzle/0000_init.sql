CREATE TYPE "public"."account_status" AS ENUM('pending_verification', 'active', 'suspended', 'deactivated');--> statement-breakpoint
CREATE TYPE "public"."contact_channel" AS ENUM('email', 'phone');--> statement-breakpoint
CREATE TYPE "public"."document_verification_status" AS ENUM('submitted', 'pending_review', 'needs_resubmission', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."driver_approval_status" AS ENUM('not_submitted', 'pending_review', 'needs_resubmission', 'approved', 'rejected', 'expired', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."driver_document_type" AS ENUM('driving_licence', 'identity_proof', 'address_proof');--> statement-breakpoint
CREATE TYPE "public"."fuel_type" AS ENUM('petrol', 'diesel', 'cng', 'electric', 'hybrid', 'other');--> statement-breakpoint
CREATE TYPE "public"."identity_status" AS ENUM('not_started', 'pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('signup', 'password_reset', 'contact_change');--> statement-breakpoint
CREATE TYPE "public"."transmission" AS ENUM('manual', 'automatic');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('consumer', 'driver', 'admin', 'super_admin');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('hatchback', 'sedan', 'suv', 'muv', 'luxury', 'van', 'pickup', 'other');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"metadata" jsonb,
	"ip_address" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "consumer_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"full_name" text,
	"address" text,
	"city" text,
	"profile_photo_key" text,
	"identity_status" "identity_status" DEFAULT 'not_started' NOT NULL,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consumer_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "driver_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"document_type" "driver_document_type" NOT NULL,
	"document_subtype" text,
	"storage_key" text NOT NULL,
	"file_name" text,
	"mime_type" text,
	"size_bytes" integer,
	"verification_status" "document_verification_status" DEFAULT 'submitted' NOT NULL,
	"document_number_encrypted" text,
	"document_number_last4" text,
	"issuing_authority" text,
	"issue_date" date,
	"expiry_date" date,
	"metadata" jsonb,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"reviewer_id" uuid,
	"review_reason" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "driver_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "driver_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"full_name" text,
	"date_of_birth" date,
	"home_city" text,
	"home_state" text,
	"profile_photo_key" text,
	"bio" text,
	"experience_years" smallint,
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"approval_status" "driver_approval_status" DEFAULT 'not_submitted' NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"review_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "driver_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "driver_service_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"state_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "driver_service_areas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by_session_id" uuid,
	"device_metadata" jsonb,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"phone" text,
	"password_hash" text,
	"role" "user_role" NOT NULL,
	"account_status" "account_status" DEFAULT 'pending_verification' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"phone_verified_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consumer_id" uuid NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"vehicle_type" "vehicle_type" NOT NULL,
	"transmission" "transmission" NOT NULL,
	"fuel_type" "fuel_type",
	"registration_reference" text,
	"notes" text,
	"status" "vehicle_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vehicles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "verification_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" "contact_channel" NOT NULL,
	"target" text NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verification_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumer_profiles" ADD CONSTRAINT "consumer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_service_areas" ADD CONSTRAINT "driver_service_areas_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_consumer_id_users_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "driver_documents_driver_type_unique" ON "driver_documents" USING btree ("driver_id","document_type");--> statement-breakpoint
CREATE INDEX "driver_documents_status_idx" ON "driver_documents" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "driver_profiles_approval_idx" ON "driver_profiles" USING btree ("approval_status");--> statement-breakpoint
CREATE UNIQUE INDEX "driver_service_areas_unique" ON "driver_service_areas" USING btree ("driver_id","state_code");--> statement-breakpoint
CREATE INDEX "driver_service_areas_state_idx" ON "driver_service_areas" USING btree ("state_code");--> statement-breakpoint
CREATE UNIQUE INDEX "user_sessions_token_hash_unique" ON "user_sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "user_sessions_user_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_unique" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "users_role_status_idx" ON "users" USING btree ("role","account_status");--> statement-breakpoint
CREATE INDEX "vehicles_consumer_status_idx" ON "vehicles" USING btree ("consumer_id","status");--> statement-breakpoint
CREATE INDEX "verification_codes_lookup_idx" ON "verification_codes" USING btree ("user_id","purpose","created_at");