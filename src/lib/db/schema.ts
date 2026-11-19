import {
  bigint,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

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
