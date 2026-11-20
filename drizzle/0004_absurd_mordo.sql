CREATE TABLE "rate_limits" (
	"clave" text PRIMARY KEY NOT NULL,
	"inicio" timestamp with time zone NOT NULL,
	"conteo" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;