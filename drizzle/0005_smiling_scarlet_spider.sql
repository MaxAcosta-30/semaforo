CREATE TABLE "checklist_marks" (
	"product_id" uuid NOT NULL,
	"version" text NOT NULL,
	"item" text NOT NULL,
	"marcado_por" text NOT NULL,
	"marcado_at" timestamp with time zone NOT NULL,
	CONSTRAINT "checklist_marks_product_id_version_item_pk" PRIMARY KEY("product_id","version","item")
);
--> statement-breakpoint
ALTER TABLE "checklist_marks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "release_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"version" text NOT NULL,
	"aprobado_por" text NOT NULL,
	"aprobado_at" timestamp with time zone NOT NULL,
	"color" text NOT NULL,
	"motivos" jsonb NOT NULL,
	CONSTRAINT "uq_release_approvals_version" UNIQUE("product_id","version")
);
--> statement-breakpoint
ALTER TABLE "release_approvals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "version_candidata" text DEFAULT 'v1.0.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_marks" ADD CONSTRAINT "checklist_marks_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_approvals" ADD CONSTRAINT "release_approvals_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;