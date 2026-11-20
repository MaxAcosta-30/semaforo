import { sql } from "drizzle-orm";
import type { getDb } from "@/lib/db/client";

type Db = ReturnType<typeof getDb>;

/**
 * Ventana fija por clave, atómica en una sola sentencia (dos peticiones a la vez no se
 * cuentan como una). Devuelve true si todavía está dentro del límite.
 */
export async function permitir(
  db: Db,
  clave: string,
  maximo: number,
  ventanaMs: number,
  ahora = new Date(),
): Promise<boolean> {
  // Como texto ISO con ::timestamptz: el driver no acepta Date en SQL crudo.
  const ya = ahora.toISOString();
  const desde = new Date(ahora.getTime() - ventanaMs).toISOString();
  const [fila] = await db.execute<{ conteo: number }>(sql`
    insert into rate_limits (clave, inicio, conteo) values (${clave}, ${ya}::timestamptz, 1)
    on conflict (clave) do update set
      inicio = case when rate_limits.inicio <= ${desde}::timestamptz then ${ya}::timestamptz else rate_limits.inicio end,
      conteo = case when rate_limits.inicio <= ${desde}::timestamptz then 1 else rate_limits.conteo + 1 end
    returning conteo
  `);
  return Number(fila?.conteo ?? 1) <= maximo;
}

/** IP del cliente detrás del proxy de Vercel. */
export function ipDe(
  headers: Headers | Record<string, string | string[] | undefined>,
): string {
  const valor =
    headers instanceof Headers
      ? headers.get("x-forwarded-for")
      : headers["x-forwarded-for"];
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return texto?.split(",")[0]?.trim() || "desconocida";
}
