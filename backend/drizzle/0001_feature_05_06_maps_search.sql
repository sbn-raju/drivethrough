CREATE TYPE "public"."route_coverage_status" AS ENUM('determined', 'approximate', 'uncertain');--> statement-breakpoint
CREATE TYPE "public"."trip_type" AS ENUM('one_way', 'round_trip');--> statement-breakpoint
CREATE TABLE "driver_preferences" (
	"driver_id" uuid PRIMARY KEY NOT NULL,
	"is_bookable" boolean DEFAULT false NOT NULL,
	"trip_types" "trip_type"[] DEFAULT '{}' NOT NULL,
	"vehicle_types" "vehicle_type"[] DEFAULT '{}' NOT NULL,
	"transmissions" "transmission"[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "driver_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "driver_rate_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"hourly_rate_minor" integer NOT NULL,
	"minimum_billable_hours" smallint NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "driver_rate_cards_rate_positive" CHECK ("driver_rate_cards"."hourly_rate_minor" > 0),
	CONSTRAINT "driver_rate_cards_min_hours_positive" CHECK ("driver_rate_cards"."minimum_billable_hours" > 0)
);
--> statement-breakpoint
ALTER TABLE "driver_rate_cards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "driver_weekly_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"start_minute" smallint NOT NULL,
	"end_minute" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "driver_weekly_availability_day" CHECK ("driver_weekly_availability"."day_of_week" between 0 and 6),
	CONSTRAINT "driver_weekly_availability_window" CHECK ("driver_weekly_availability"."start_minute" >= 0 and "driver_weekly_availability"."end_minute" <= 1440 and "driver_weekly_availability"."start_minute" < "driver_weekly_availability"."end_minute")
);
--> statement-breakpoint
ALTER TABLE "driver_weekly_availability" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "route_estimates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consumer_id" uuid NOT NULL,
	"pickup" jsonb NOT NULL,
	"drop" jsonb NOT NULL,
	"distance_meters" integer NOT NULL,
	"duration_seconds" integer NOT NULL,
	"route_state_codes" text[] NOT NULL,
	"coverage_status" "route_coverage_status" NOT NULL,
	"route_state_method" text NOT NULL,
	"provider" text NOT NULL,
	"provider_metadata" jsonb,
	"estimated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "route_estimates_distance_positive" CHECK ("route_estimates"."distance_meters" > 0),
	CONSTRAINT "route_estimates_duration_positive" CHECK ("route_estimates"."duration_seconds" > 0)
);
--> statement-breakpoint
ALTER TABLE "route_estimates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "service_states" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_states" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "driver_preferences" ADD CONSTRAINT "driver_preferences_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_rate_cards" ADD CONSTRAINT "driver_rate_cards_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_weekly_availability" ADD CONSTRAINT "driver_weekly_availability_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_estimates" ADD CONSTRAINT "route_estimates_consumer_id_users_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "driver_preferences_bookable_idx" ON "driver_preferences" USING btree ("driver_id") WHERE "driver_preferences"."is_bookable";--> statement-breakpoint
CREATE UNIQUE INDEX "driver_rate_cards_current_unique" ON "driver_rate_cards" USING btree ("driver_id") WHERE "driver_rate_cards"."effective_to" is null;--> statement-breakpoint
CREATE INDEX "driver_rate_cards_driver_idx" ON "driver_rate_cards" USING btree ("driver_id","effective_from");--> statement-breakpoint
CREATE INDEX "driver_weekly_availability_driver_idx" ON "driver_weekly_availability" USING btree ("driver_id","day_of_week");--> statement-breakpoint
CREATE INDEX "route_estimates_consumer_idx" ON "route_estimates" USING btree ("consumer_id","estimated_at");--> statement-breakpoint
-- Seed the supported-state reference table (Feature 04 §3). Enabling/disabling states is an admin task (Feature 12).
INSERT INTO "service_states" ("code", "name") VALUES
  ('AN', 'Andaman and Nicobar Islands'),
  ('AP', 'Andhra Pradesh'),
  ('AR', 'Arunachal Pradesh'),
  ('AS', 'Assam'),
  ('BR', 'Bihar'),
  ('CH', 'Chandigarh'),
  ('CT', 'Chhattisgarh'),
  ('DH', 'Dadra and Nagar Haveli and Daman and Diu'),
  ('DL', 'Delhi'),
  ('GA', 'Goa'),
  ('GJ', 'Gujarat'),
  ('HP', 'Himachal Pradesh'),
  ('HR', 'Haryana'),
  ('JH', 'Jharkhand'),
  ('JK', 'Jammu and Kashmir'),
  ('KA', 'Karnataka'),
  ('KL', 'Kerala'),
  ('LA', 'Ladakh'),
  ('LD', 'Lakshadweep'),
  ('MH', 'Maharashtra'),
  ('ML', 'Meghalaya'),
  ('MN', 'Manipur'),
  ('MP', 'Madhya Pradesh'),
  ('MZ', 'Mizoram'),
  ('NL', 'Nagaland'),
  ('OR', 'Odisha'),
  ('PB', 'Punjab'),
  ('PY', 'Puducherry'),
  ('RJ', 'Rajasthan'),
  ('SK', 'Sikkim'),
  ('TG', 'Telangana'),
  ('TN', 'Tamil Nadu'),
  ('TR', 'Tripura'),
  ('UP', 'Uttar Pradesh'),
  ('UT', 'Uttarakhand'),
  ('WB', 'West Bengal')
ON CONFLICT ("code") DO NOTHING;
