CREATE TYPE "public"."member_role" AS ENUM('admin', 'lector');--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_id" bigint NOT NULL,
	"github_login" text NOT NULL,
	"role" "member_role" DEFAULT 'lector' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_github_id_unique" UNIQUE("github_id")
);
