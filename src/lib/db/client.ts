import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");

  // prepare: false porque el transaction pooler de Supabase no admite prepared statements.
  const sql = postgres(url, { prepare: false, max: 1 });
  return drizzle(sql, { schema });
}

let db: ReturnType<typeof createDb> | undefined;

// Se crea al primer uso para que el build no necesite la base de datos.
export function getDb() {
  db ??= createDb();
  return db;
}

export async function isDbReachable(): Promise<boolean> {
  try {
    await getDb().execute(sql`select 1`);
    return true;
  } catch (error) {
    console.error("db: la base de datos no respondió", error);
    return false;
  }
}
