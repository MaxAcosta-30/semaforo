import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  primaryKey,
  smallint,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const memberRole = pgEnum("member_role", ["admin", "lector"]);

// Toda tabla lleva RLS sin políticas: la API automática de Supabase (roles anon y
// authenticated) no puede leer ni escribir. El servidor entra como dueño y no le afecta (ADR 0002).

// Solo entran a Semáforo las cuentas de GitHub registradas aquí (caso 1).
export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
  githubLogin: text("github_login").notNull(),
  role: memberRole("role").notNull().default("lector"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

// Caso 2 (modelo): productos y los endpoints que se vigilan. El registro desde la interfaz
// llega con el caso 2 completo; el monitor (caso 3) ya los usa.
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  repo: text("repo").notNull(), // "dueño/repositorio" en GitHub
  isPublic: boolean("is_public").notNull().default(false),
  // Caso 6: la versión que se está preparando; la checklist y la aprobación son de esta versión.
  versionCandidata: text("version_candidata").notNull().default("v1.0.0"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

export const endpoints = pgTable(
  "endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    expectedStatus: integer("expected_status").notNull().default(200),
    maxLatencyMs: integer("max_latency_ms").notNull().default(1000),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("uq_endpoints_product_url").on(t.productId, t.url)],
).enableRLS();

// Caso 3: un registro por revisión. Se borran a los 30 días (límite de 500 MB de Supabase).
export const checks = pgTable(
  "checks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => endpoints.id, { onDelete: "cascade" }),
    checkedAt: timestamp("checked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ok: boolean("ok").notNull(),
    status: integer("status"),
    latencyMs: integer("latency_ms"),
    error: text("error"),
  },
  (t) => [
    index("ix_checks_endpoint_fecha").on(t.endpointId, t.checkedAt.desc()),
  ],
).enableRLS();

// Caso 7: se abre con 3 fallos seguidos y se cierra con 2 éxitos seguidos.
export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => endpoints.id, { onDelete: "cascade" }),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    reason: text("reason").notNull(),
  },
  (t) => [
    index("ix_incidents_endpoint").on(t.endpointId, t.openedAt.desc()),
    // Nunca dos incidentes abiertos del mismo endpoint, aunque dos corridas se crucen.
    uniqueIndex("ux_incidents_abierto")
      .on(t.endpointId)
      .where(sql`${t.closedAt} is null`),
  ],
).enableRLS();

// Cada corrida del monitor: sirve para avisar si dejó de correr (caso 9).
export const monitorRuns = pgTable("monitor_runs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
  checked: integer("checked").notNull(),
  failed: integer("failed").notNull(),
}).enableRLS();

// Caso 4: última respuesta de la API de GitHub por repositorio y recurso, con su ETag
// para pedir solo si cambió (un 304 autenticado no gasta límite).
export const githubSnapshots = pgTable(
  "github_snapshots",
  {
    repo: text("repo").notNull(),
    recurso: text("recurso").notNull(), // "ci" | "release" | "prs"
    etag: text("etag"),
    datos: jsonb("datos"),
    consultadoAt: timestamp("consultado_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.repo, t.recurso] })],
).enableRLS();

// Caso 4: lo que GitHub dijo del límite en la última respuesta (una sola fila).
export const githubRateLimit = pgTable("github_rate_limit", {
  id: smallint("id").primaryKey().default(1),
  remaining: integer("remaining").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
}).enableRLS();

// Límite de intentos por clave (por ejemplo "demo:<ip>"). En serverless cada instancia tiene
// su propia memoria, así que el conteo vive en PostgreSQL.
export const rateLimits = pgTable("rate_limits", {
  clave: text("clave").primaryKey(),
  inicio: timestamp("inicio", { withTimezone: true }).notNull(),
  conteo: integer("conteo").notNull(),
}).enableRLS();

// Caso 6: la checklist manual se marca por versión. Los renglones son fijos (CHECKLIST en
// src/lib/aprobaciones.ts); aquí solo se guarda quién marcó cada uno y cuándo.
export const checklistMarks = pgTable(
  "checklist_marks",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    item: text("item").notNull(),
    marcadoPor: text("marcado_por").notNull(),
    marcadoAt: timestamp("marcado_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.version, t.item] })],
).enableRLS();

// Caso 6: aprobar guarda quién, cuándo y el color con sus motivos en ese momento.
export const releaseApprovals = pgTable(
  "release_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    aprobadoPor: text("aprobado_por").notNull(),
    aprobadoAt: timestamp("aprobado_at", { withTimezone: true }).notNull(),
    color: text("color").notNull(),
    motivos: jsonb("motivos").notNull(),
  },
  (t) => [unique("uq_release_approvals_version").on(t.productId, t.version)],
).enableRLS();
