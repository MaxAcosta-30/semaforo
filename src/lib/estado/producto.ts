// Caso 5 con datos reales: junta checks, incidentes y GitHub de un producto y aplica las
// reglas puras del semáforo. También arma la vía de 24 bloques del diseño "Enclavamiento".

import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { checklistDe } from "@/lib/aprobaciones";
import type { getDb } from "@/lib/db/client";
import { checks, endpoints, incidents, products } from "@/lib/db/schema";
import {
  contarEnVentana,
  disponibilidad,
  p95EnVentana,
  VENTANA_24H_MS,
  VENTANA_7D_MS,
  type Check,
} from "@/lib/domain/metricas";
import {
  calcularSemaforo,
  type EstadoCi,
  type ResultadoSemaforo,
} from "@/lib/domain/semaforo";

type Db = ReturnType<typeof getDb>;
const HORA = 3_600_000;

export type Bloque = "ok" | "lento" | "falla" | "sin-datos";
export type EstadoPublico = "normal" | "incidente" | "degradado" | "sin-datos";

export interface Incidente {
  id: string;
  endpoint: string;
  abierto: Date;
  cerrado: Date | null;
  motivo: string;
}

export interface EstadoProducto {
  producto: {
    id: string;
    nombre: string;
    slug: string;
    repo: string;
    publico: boolean;
    version: string;
  };
  semaforo: ResultadoSemaforo;
  publico: EstadoPublico;
  disponibilidad24h: number | null;
  disponibilidad7d: number | null;
  p95: { ms: number; maximo: number } | null;
  ultimoCheck: Date | null;
  bloques: Bloque[]; // 24, del más viejo al más reciente
  incidentes: Incidente[]; // últimos 7 días, el más reciente primero
}

export interface Fuentes {
  ahora?: Date;
  /** Estado del CI de main; por defecto "desconocido" (nunca verde sin datos). */
  ci?: (repo: string) => Promise<EstadoCi>;
  /** Caso 6: si la checklist de la versión está completa. Hasta construirlo, sin checklist = completa. */
  checklistCompleta?: boolean;
}

export async function estadoDeProducto(
  db: Db,
  slug: string,
  fuentes: Fuentes = {},
): Promise<EstadoProducto | null> {
  const ahora = fuentes.ahora ?? new Date();
  const [p] = await db.select().from(products).where(eq(products.slug, slug));
  if (!p) return null;

  const eps = await db
    .select()
    .from(endpoints)
    .where(eq(endpoints.productId, p.id));
  const ids = eps.map((e) => e.id);
  const filas = ids.length
    ? await db
        .select()
        .from(checks)
        .where(
          and(
            inArray(checks.endpointId, ids),
            gte(checks.checkedAt, new Date(ahora.getTime() - VENTANA_7D_MS)),
          ),
        )
        .orderBy(desc(checks.checkedAt))
    : [];
  const aCheck = (c: (typeof filas)[number]): Check => ({
    at: c.checkedAt,
    ok: c.ok,
    latenciaMs: c.latencyMs,
  });
  const todos = filas.map(aCheck);

  // p95 por endpoint contra su propio máximo; se reporta el que más se pasa.
  let peor: { ms: number; maximo: number } | null = null;
  for (const ep of eps) {
    const ms = p95EnVentana(
      filas.filter((c) => c.endpointId === ep.id).map(aCheck),
      ahora,
      VENTANA_24H_MS,
    );
    if (
      ms !== null &&
      (peor === null || ms / ep.maxLatencyMs > peor.ms / peor.maximo)
    )
      peor = { ms, maximo: ep.maxLatencyMs };
  }

  const incs = ids.length
    ? await db
        .select()
        .from(incidents)
        .where(
          and(
            inArray(incidents.endpointId, ids),
            gte(incidents.openedAt, new Date(ahora.getTime() - VENTANA_7D_MS)),
          ),
        )
        .orderBy(desc(incidents.openedAt))
    : [];
  const abiertos = ids.length
    ? await db
        .select({ id: incidents.id })
        .from(incidents)
        .where(
          and(inArray(incidents.endpointId, ids), isNull(incidents.closedAt)),
        )
    : [];
  const urlDe = new Map(eps.map((e) => [e.id, e.url]));

  const d24 = disponibilidad(todos, ahora, VENTANA_24H_MS);
  const ultimoCheck = filas[0]?.checkedAt ?? null;
  const ci = fuentes.ci
    ? await fuentes.ci(p.repo).catch((): EstadoCi => "desconocido")
    : "desconocido";
  const semaforo = calcularSemaforo({
    ahora,
    ciMain: ci,
    incidenteAbierto: abiertos.length > 0,
    disponibilidad24h: d24,
    checks24h: contarEnVentana(todos, ahora, VENTANA_24H_MS),
    latenciaP95Ms: peor?.ms ?? null,
    latenciaMaximaMs: peor?.maximo ?? Number.POSITIVE_INFINITY,
    ultimoCheck,
    checklistCompleta:
      fuentes.checklistCompleta ??
      (await checklistDe(db, p.id, p.versionCandidata)).completa,
  });

  const maximoDe = new Map(eps.map((e) => [e.id, e.maxLatencyMs]));
  const bloques: Bloque[] = Array.from({ length: 24 }, (_, i) => {
    const desde = ahora.getTime() - (24 - i) * HORA;
    const enHora = filas.filter(
      (c) =>
        c.checkedAt.getTime() > desde && c.checkedAt.getTime() <= desde + HORA,
    );
    if (enHora.length === 0) return "sin-datos";
    if (enHora.some((c) => !c.ok)) return "falla";
    if (
      enHora.some(
        (c) => (c.latencyMs ?? 0) > (maximoDe.get(c.endpointId) ?? Infinity),
      )
    )
      return "lento";
    return "ok";
  });

  return {
    producto: {
      id: p.id,
      nombre: p.name,
      slug: p.slug,
      repo: p.repo,
      publico: p.isPublic,
      version: p.versionCandidata,
    },
    semaforo,
    publico:
      abiertos.length > 0
        ? "incidente"
        : d24 === null
          ? "sin-datos"
          : d24 < 0.99
            ? "degradado"
            : "normal",
    disponibilidad24h: d24,
    disponibilidad7d: disponibilidad(todos, ahora, VENTANA_7D_MS),
    p95: peor,
    ultimoCheck,
    bloques,
    incidentes: incs.map((i) => ({
      id: i.id,
      endpoint: urlDe.get(i.endpointId) ?? "",
      abierto: i.openedAt,
      cerrado: i.closedAt,
      motivo: i.reason,
    })),
  };
}

/** Porcentaje truncado a 1 decimal: 98.96 % nunca se muestra como "99.0 %". */
export function porcentaje(v: number | null): string {
  return v === null ? "—" : `${(Math.floor(v * 1000) / 10).toFixed(1)} %`;
}
