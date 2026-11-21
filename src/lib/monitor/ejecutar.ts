// Caso 3: una corrida del monitor. Revisa todos los endpoints, guarda cada check,
// actualiza los incidentes (caso 7) y registra la corrida para saber si el monitor se detuvo.

import { lookup } from "node:dns/promises";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { getDb } from "@/lib/db/client";
import {
  checks,
  endpoints,
  incidents,
  monitorRuns,
  products,
} from "@/lib/db/schema";
import { alertarApertura, alertarCierre } from "@/lib/alertas/discord";
import { registrarCheck, type EstadoIncidente } from "@/lib/domain/incidentes";
import { peticionHttps, type Peticion } from "./peticion";
import { type Resolver, validarUrl } from "./ssrf";

type Db = ReturnType<typeof getDb>;

export const CONCURRENCIA = 5; // con timeout de 10 s, 5 a la vez caben de sobra en 300 s

export const resolverDns: Resolver = async (host) =>
  (await lookup(host, { all: true, verbatim: true })).map((d) => d.address);

export interface ResumenCorrida {
  revisados: number;
  fallidos: number;
  incidentesAbiertos: number;
  incidentesCerrados: number;
}

interface Dependencias {
  ahora?: () => Date;
  peticion?: Peticion;
  resolver?: Resolver;
}

export async function ejecutarMonitor(
  db: Db,
  dep: Dependencias = {},
): Promise<ResumenCorrida> {
  const ahora = dep.ahora ?? (() => new Date());
  const peticion = dep.peticion ?? peticionHttps;
  const resolver = dep.resolver ?? resolverDns;
  const inicio = ahora();
  const resumen: ResumenCorrida = {
    revisados: 0,
    fallidos: 0,
    incidentesAbiertos: 0,
    incidentesCerrados: 0,
  };

  const lista = await db
    .select({
      id: endpoints.id,
      url: endpoints.url,
      expectedStatus: endpoints.expectedStatus,
      producto: products.name,
      slug: products.slug,
    })
    .from(endpoints)
    .innerJoin(products, eq(endpoints.productId, products.id));
  for (let i = 0; i < lista.length; i += CONCURRENCIA) {
    await Promise.all(
      lista.slice(i, i + CONCURRENCIA).map(async (ep) => {
        const resultado = await revisar(
          ep.url,
          ep.expectedStatus,
          peticion,
          resolver,
        );
        const cuando = ahora();
        await db
          .insert(checks)
          .values({ endpointId: ep.id, checkedAt: cuando, ...resultado });
        resumen.revisados++;
        if (!resultado.ok) resumen.fallidos++;

        const cambio = await actualizarIncidente(db, ep.id, resultado, cuando);
        if (cambio?.evento === "abrir") resumen.incidentesAbiertos++;
        if (cambio?.evento === "cerrar") resumen.incidentesCerrados++;

        // Después de confirmada la escritura; enviar nunca lanza (captura sus errores).
        const datos = {
          producto: ep.producto,
          slug: ep.slug,
          endpoint: ep.url,
        };
        if (cambio?.evento === "abrir") {
          await alertarApertura(datos, cambio.causa);
        } else if (cambio?.evento === "cerrar") {
          await alertarCierre(datos, cambio.duracionMs);
        }
      }),
    );
  }

  await db.insert(monitorRuns).values({
    startedAt: inicio,
    finishedAt: ahora(),
    checked: resumen.revisados,
    failed: resumen.fallidos,
  });
  return resumen;
}

async function revisar(
  url: string,
  esperado: number,
  peticion: Peticion,
  resolver: Resolver,
) {
  // Se valida en cada corrida, no solo al registrar: el DNS pudo cambiar desde entonces.
  const validada = await validarUrl(url, resolver);
  if (!validada.ok) {
    return {
      ok: false,
      status: null,
      latencyMs: null,
      error: `URL bloqueada: ${validada.motivo}`,
    };
  }
  const r = await peticion(validada.url, validada.direcciones);
  const ok = r.error === null && r.status === esperado;
  const error =
    r.error ?? (ok ? null : `Respondió ${r.status}; se esperaba ${esperado}`);
  return { ok, status: r.status, latencyMs: r.latenciaMs, error };
}

/** Reconstruye el estado de la máquina de incidentes con los checks recientes y la aplica. */
async function actualizarIncidente(
  db: Db,
  endpointId: string,
  resultado: { ok: boolean; error: string | null },
  cuando: Date,
) {
  const [abierto] = await db
    .select({ id: incidents.id, openedAt: incidents.openedAt })
    .from(incidents)
    .where(
      and(eq(incidents.endpointId, endpointId), isNull(incidents.closedAt)),
    )
    .limit(1);

  // Los checks anteriores al actual (el actual ya está guardado: se salta).
  const previos = await db
    .select({ ok: checks.ok })
    .from(checks)
    .where(eq(checks.endpointId, endpointId))
    .orderBy(desc(checks.checkedAt), desc(checks.id))
    .limit(10)
    .offset(1);

  const estado: EstadoIncidente = {
    abierto: abierto !== undefined,
    fallosSeguidos: rachaInicial(previos, false),
    exitosSeguidos: rachaInicial(previos, true),
  };
  const { evento } = registrarCheck(estado, resultado.ok);

  if (evento === "abrir") {
    const causa = resultado.error ?? "Falló 3 veces seguidas";
    const nuevos = await db
      .insert(incidents)
      .values({ endpointId, openedAt: cuando, reason: causa })
      .onConflictDoNothing() // ux_incidents_abierto: si otra corrida ya lo abrió, no se duplica
      .returning({ id: incidents.id });
    // Sin fila insertada otra corrida lo abrió: no se repite la alerta.
    return nuevos.length > 0 ? { evento, causa } : null;
  }
  if (evento === "cerrar" && abierto) {
    await db
      .update(incidents)
      .set({ closedAt: cuando })
      .where(eq(incidents.id, abierto.id));
    return {
      evento,
      duracionMs: cuando.getTime() - abierto.openedAt.getTime(),
    };
  }
  return null;
}

function rachaInicial(lista: { ok: boolean }[], valor: boolean): number {
  let n = 0;
  for (const c of lista) {
    if (c.ok !== valor) break;
    n++;
  }
  return n;
}
