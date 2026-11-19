import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/lib/db/client";

export async function GET() {
  // Siempre en tiempo de petición: un health check prerenderizado no dice nada.
  await connection();

  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ ok: true, db: "ok" });
  } catch (error) {
    console.error("health: la base de datos no respondió", error);
    // Respuesta genérica: no se exponen detalles de la conexión.
    return Response.json({ ok: false, db: "error" }, { status: 503 });
  }
}
