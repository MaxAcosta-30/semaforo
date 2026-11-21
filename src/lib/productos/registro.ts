// Caso 2: registrar un producto con sus endpoints. Zod valida forma; validarUrl, SSRF.

import type { getDb } from "@/lib/db/client";
import { endpoints, products } from "@/lib/db/schema";
import { resolverDns } from "@/lib/monitor/ejecutar";
import { esquemaProducto } from "./esquema";
import { type Resolver, validarUrl } from "@/lib/monitor/ssrf";

type Db = ReturnType<typeof getDb>;

export { esquemaProducto, type EntradaProducto } from "./esquema";

export type ResultadoRegistro =
  | { ok: true; id: string; slug: string }
  | { ok: false; estado: 400 | 409; errores: Record<string, string> };

export async function registrarProducto(
  db: Db,
  entrada: unknown,
  resolver: Resolver = resolverDns,
): Promise<ResultadoRegistro> {
  const datos = esquemaProducto.safeParse(entrada);
  if (!datos.success) {
    return {
      ok: false,
      estado: 400,
      errores: Object.fromEntries(
        datos.error.issues.map((i) => [i.path.join("."), i.message]),
      ),
    };
  }
  const p = datos.data;

  // SSRF: cada URL debe ser https:443 y resolver solo a IPs públicas
  // (el monitor la vuelve a validar en cada corrida).
  const errores: Record<string, string> = {};
  await Promise.all(
    p.endpoints.map(async (e, i) => {
      const v = await validarUrl(e.url, resolver);
      if (!v.ok) errores[`endpoints.${i}.url`] = v.motivo;
    }),
  );
  if (Object.keys(errores).length > 0)
    return { ok: false, estado: 400, errores };

  try {
    return await db.transaction(async (tx) => {
      const [creado] = await tx
        .insert(products)
        .values({
          name: p.nombre,
          slug: p.slug,
          repo: p.repo,
          isPublic: p.publico,
        })
        .returning({ id: products.id, slug: products.slug });
      await tx.insert(endpoints).values(
        p.endpoints.map((e) => ({
          productId: creado!.id,
          url: e.url,
          expectedStatus: e.estadoEsperado,
          maxLatencyMs: e.latenciaMaximaMs,
        })),
      );
      return { ok: true as const, id: creado!.id, slug: creado!.slug };
    });
  } catch (e) {
    const codigo =
      (e as { cause?: { code?: string }; code?: string }).cause?.code ??
      (e as { code?: string }).code;
    if (codigo === "23505") {
      return {
        ok: false,
        estado: 409,
        errores: { slug: "Ya existe un producto con ese slug." },
      };
    }
    throw e;
  }
}
