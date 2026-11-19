import { connection } from "next/server";
import { isDbReachable } from "@/lib/db/client";

export async function GET() {
  // Siempre en tiempo de petición: un health check prerenderizado no dice nada.
  await connection();

  if (await isDbReachable()) return Response.json({ ok: true, db: "ok" });
  // Respuesta genérica: no se exponen detalles de la conexión.
  return Response.json({ ok: false, db: "error" }, { status: 503 });
}
