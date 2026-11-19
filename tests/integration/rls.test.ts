import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";

// Protege contra la API automática de Supabase: una tabla nueva sin RLS rompe esta prueba (ADR 0002).
describe("RLS", () => {
  it("está activo en todas las tablas de public", async () => {
    const rows = await getDb().execute<{ table: string; rls: boolean }>(sql`
      select c.relname as table, c.relrowsecurity as rls
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
    `);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((r) => !r.rls).map((r) => r.table)).toEqual([]);
  });
});
