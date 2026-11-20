import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  pgEnum,
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
