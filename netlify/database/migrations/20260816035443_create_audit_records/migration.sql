CREATE TABLE "audit_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"property_name" text NOT NULL,
	"inspector_name" text NOT NULL,
	"building" text NOT NULL,
	"unit" text NOT NULL,
	"handrail_condition" text NOT NULL,
	"handrail_notes" text DEFAULT '' NOT NULL,
	"building_notes" text DEFAULT '' NOT NULL,
	"total_steps" integer NOT NULL,
	"steps_data" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"inspected_at" timestamp with time zone DEFAULT now() NOT NULL
);
