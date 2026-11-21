CREATE TABLE "github_deliveries" (
	"delivery_id" text PRIMARY KEY NOT NULL,
	"event" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_deliveries" ENABLE ROW LEVEL SECURITY;