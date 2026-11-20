CREATE TABLE "github_rate_limit" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"remaining" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_rate_limit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "github_snapshots" (
	"repo" text NOT NULL,
	"recurso" text NOT NULL,
	"etag" text,
	"datos" jsonb,
	"consultado_at" timestamp with time zone NOT NULL,
	CONSTRAINT "github_snapshots_repo_recurso_pk" PRIMARY KEY("repo","recurso")
);
--> statement-breakpoint
ALTER TABLE "github_snapshots" ENABLE ROW LEVEL SECURITY;