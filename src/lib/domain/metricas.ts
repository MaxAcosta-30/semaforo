// Caso 3: disponibilidad y latencia p95 a partir de los checks guardados.
// Funciones puras: reciben los checks y la ventana, no tocan la base.

export interface Check {
  at: Date;
  ok: boolean;
  latenciaMs: number | null; // null si hubo timeout o error de red
}

const HORA_MS = 60 * 60 * 1000;
export const VENTANA_24H_MS = 24 * HORA_MS;
export const VENTANA_7D_MS = 7 * 24 * HORA_MS;

function enVentana(
  checks: readonly Check[],
  ahora: Date,
  ventanaMs: number,
): Check[] {
  const desde = ahora.getTime() - ventanaMs;
  return checks.filter(
    (c) => c.at.getTime() > desde && c.at.getTime() <= ahora.getTime(),
  );
}

/** Proporción de checks exitosos en la ventana (0 a 1). `null` si no hay checks. */
export function disponibilidad(
  checks: readonly Check[],
  ahora: Date,
  ventanaMs: number,
): number | null {
  const ventana = enVentana(checks, ahora, ventanaMs);
  if (ventana.length === 0) return null;
  return ventana.filter((c) => c.ok).length / ventana.length;
}

/**
 * Percentil 95 por rango más cercano (nearest-rank): el valor en la posición
 * ceil(0.95 × n) de la lista ordenada. Siempre es una latencia que sí ocurrió.
 */
export function p95(latencias: readonly number[]): number | null {
  if (latencias.length === 0) return null;
  const ordenadas = [...latencias].sort((a, b) => a - b);
  const rango = Math.ceil(0.95 * ordenadas.length);
  return ordenadas[rango - 1] ?? null;
}

/** p95 de los checks exitosos de la ventana; los fallos ya cuentan en la disponibilidad. */
export function p95EnVentana(
  checks: readonly Check[],
  ahora: Date,
  ventanaMs: number,
): number | null {
  const latencias = enVentana(checks, ahora, ventanaMs)
    .filter((c) => c.ok && c.latenciaMs !== null)
    .map((c) => c.latenciaMs as number);
  return p95(latencias);
}

export function contarEnVentana(
  checks: readonly Check[],
  ahora: Date,
  ventanaMs: number,
): number {
  return enVentana(checks, ahora, ventanaMs).length;
}
