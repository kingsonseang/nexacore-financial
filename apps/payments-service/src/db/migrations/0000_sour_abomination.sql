CREATE TYPE "public"."currency" AS ENUM('NGN', 'USD');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('deposit', 'withdrawal');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" numeric(20, 2) NOT NULL,
	"currency" "currency" NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"type" "payment_type" NOT NULL,
	"reference" text NOT NULL,
	"payment_url" text,
	"bank_code" text,
	"account_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE INDEX "payments_user_id_idx" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payments_reference_idx" ON "payments" USING btree ("reference");