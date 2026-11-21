// Caso 9: datos de la demo (Hito y 2 productos de ejemplo). Idempotente: upsert por slug.
// Usa las mismas validaciones que el registro normal (Zod y SSRF).

import { eq } from "drizzle-orm";
import type { getDb } from "@/lib/db/client";
import { endpoints, products } from "@/lib/db/schema";
import { resolverDns } from "@/lib/monitor/ejecutar";
import { esquemaProducto, registrarProducto } from "@/lib/productos/registro";
import { type Resolver, validarUrl } from "@/lib/monitor/ssrf";

type Db = ReturnType<typeof getDb>;

export const PRODUCTOS_DEMO = [
  {
    nombre: "Hito",
    slug: "hito",
    repo: "MaxAcosta-30/Hito",
    publico: true,
    endpoints: [
      {
        url: "https://hito-one.vercel.app/",
        estadoEsperado: 200,
        latenciaMaximaMs: 2000,
      },
    ],
  },
  {
    nombre: "Ejemplo · Sitio de pruebas",
    slug: "ejemplo-sitio",
    repo: "MaxAcosta-30/Semaforo",
    publico: true,
    endpoints: [
      {
        url: "https://example.com/",
        estadoEsperado: 200,
        latenciaMaximaMs: 2000,
      },
    ],
  },
  {
    nombre: "Ejemplo · Enciclopedia",
    slug: "ejemplo-enciclopedia",
    repo: "MaxAcosta-30/Semaforo",
    publico: true,
    endpoints: [
      {
        url: "https://www.wikipedia.org/",
        estadoEsperado: 200,
        latenciaMaximaMs: 2000,
      },
    ],
  },
] as const;

export async function sembrarDemo(db: Db, resolver: Resolver = resolverDns) {
  const resumen: { slug: string; accion: "creado" | "actualizado" }[] = [];
  for (const demo of PRODUCTOS_DEMO) {
    const [existente] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, demo.slug));

    if (!existente) {
      const r = await registrarProducto(db, demo, resolver);
      if (!r.ok)
        throw new Error(
          `No se pudo registrar ${demo.slug}: ${JSON.stringify(r.errores)}`,
        );
      resumen.push({ slug: demo.slug, accion: "creado" });
      continue;
    }

    const datos = esquemaProducto.parse(demo);
    for (const e of datos.endpoints) {
      const v = await validarUrl(e.url, resolver);
      if (!v.ok)
        throw new Error(`${demo.slug}: ${e.url} no válida: ${v.motivo}`);
    }
    await db.transaction(async (tx) => {
      await tx
        .update(products)
        .set({ name: datos.nombre, repo: datos.repo, isPublic: datos.publico })
        .where(eq(products.id, existente.id));
      for (const e of datos.endpoints) {
        await tx
          .insert(endpoints)
          .values({
            productId: existente.id,
            url: e.url,
            expectedStatus: e.estadoEsperado,
            maxLatencyMs: e.latenciaMaximaMs,
          })
          .onConflictDoUpdate({
            target: [endpoints.productId, endpoints.url],
            set: {
              expectedStatus: e.estadoEsperado,
              maxLatencyMs: e.latenciaMaximaMs,
            },
          });
      }
    });
    resumen.push({ slug: demo.slug, accion: "actualizado" });
  }
  return resumen;
}
