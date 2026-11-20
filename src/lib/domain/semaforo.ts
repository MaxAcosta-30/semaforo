// Caso 5: reglas del semáforo. Función pura: mismas entradas, mismo color y motivos.
//
// Rojo:     CI de main falla · incidente abierto · disponibilidad 24 h < 99 %
// Amarillo: checklist incompleta · p95 > máximo · último check con más de 45 min ·
//           datos insuficientes
// Verde:    no aplica ninguna. Si aplican varias, gana la más grave y se muestran todas.

export type Color = "verde" | "amarillo" | "rojo";
export type EstadoCi = "exito" | "fallo" | "en_curso" | "desconocido";

export interface EntradaSemaforo {
  ahora: Date;
  ciMain: EstadoCi;
  incidenteAbierto: boolean;
  disponibilidad24h: number | null; // 0 a 1
  checks24h: number;
  latenciaP95Ms: number | null;
  latenciaMaximaMs: number;
  ultimoCheck: Date | null;
  checklistCompleta: boolean;
}

export type Regla =
  | "ci_falla"
  | "incidente_abierto"
  | "disponibilidad_baja"
  | "checklist_incompleta"
  | "latencia_alta"
  | "monitor_atrasado"
  | "datos_insuficientes";

export interface Motivo {
  color: Exclude<Color, "verde">;
  regla: Regla;
  texto: string;
}

export interface ResultadoSemaforo {
  color: Color;
  motivos: Motivo[];
}

export const DISPONIBILIDAD_MINIMA = 0.99;
export const MINUTOS_MAXIMOS_SIN_CHECK = 45;
// Con un check cada 15 min hay 96 en 24 h; con menos de la mitad no se puede afirmar "verde".
export const CHECKS_MINIMOS_24H = 48;

const porcentaje = (v: number) => `${(Math.floor(v * 1000) / 10).toFixed(1)} %`;

export function calcularSemaforo(e: EntradaSemaforo): ResultadoSemaforo {
  const motivos: Motivo[] = [];
  const rojo = (regla: Regla, texto: string) =>
    motivos.push({ color: "rojo", regla, texto });
  const amarillo = (regla: Regla, texto: string) =>
    motivos.push({ color: "amarillo", regla, texto });

  if (e.ciMain === "fallo") rojo("ci_falla", "El CI de main está fallando.");
  if (e.incidenteAbierto)
    rojo("incidente_abierto", "Hay un incidente abierto.");
  if (
    e.disponibilidad24h !== null &&
    e.disponibilidad24h < DISPONIBILIDAD_MINIMA
  ) {
    rojo(
      "disponibilidad_baja",
      `Disponibilidad de 24 h en ${porcentaje(e.disponibilidad24h)} (mínimo 99 %).`,
    );
  }

  if (!e.checklistCompleta) {
    amarillo(
      "checklist_incompleta",
      "La checklist de esta versión está incompleta.",
    );
  }
  if (e.latenciaP95Ms !== null && e.latenciaP95Ms > e.latenciaMaximaMs) {
    amarillo(
      "latencia_alta",
      `La latencia p95 es de ${Math.round(e.latenciaP95Ms)} ms (máximo ${e.latenciaMaximaMs} ms).`,
    );
  }
  if (e.ultimoCheck !== null) {
    const minutos = (e.ahora.getTime() - e.ultimoCheck.getTime()) / 60_000;
    if (minutos > MINUTOS_MAXIMOS_SIN_CHECK) {
      amarillo(
        "monitor_atrasado",
        `El último check fue hace ${Math.floor(minutos)} min: el monitor podría estar detenido.`,
      );
    }
  }
  const faltan: string[] = [];
  if (e.ultimoCheck === null || e.disponibilidad24h === null)
    faltan.push("checks");
  else if (e.checks24h < CHECKS_MINIMOS_24H) {
    faltan.push(`checks (${e.checks24h} de ${CHECKS_MINIMOS_24H} en 24 h)`);
  }
  if (e.ciMain === "desconocido") faltan.push("estado del CI");
  if (e.ciMain === "en_curso") faltan.push("resultado del CI (sigue en curso)");
  if (faltan.length > 0) {
    amarillo(
      "datos_insuficientes",
      `No hay datos suficientes: ${faltan.join(", ")}.`,
    );
  }

  const color: Color = motivos.some((m) => m.color === "rojo")
    ? "rojo"
    : motivos.length > 0
      ? "amarillo"
      : "verde";
  // Los rojos primero: el motivo más grave se lee antes.
  motivos.sort((a, b) =>
    a.color === b.color ? 0 : a.color === "rojo" ? -1 : 1,
  );
  return { color, motivos };
}
