import { describe, expect, it } from "vitest";
import {
  calcularSemaforo,
  CHECKS_MINIMOS_24H,
  type EntradaSemaforo,
} from "@/lib/domain/semaforo";

const AHORA = new Date("2026-11-19T12:00:00Z");
const hace = (min: number) => new Date(AHORA.getTime() - min * 60_000);

// Un producto sano: todo en orden, datos suficientes.
const sano: EntradaSemaforo = {
  ahora: AHORA,
  ciMain: "exito",
  incidenteAbierto: false,
  disponibilidad24h: 1,
  checks24h: 96,
  latenciaP95Ms: 300,
  latenciaMaximaMs: 800,
  ultimoCheck: hace(10),
  checklistCompleta: true,
};
const con = (cambios: Partial<EntradaSemaforo>) =>
  calcularSemaforo({ ...sano, ...cambios });

describe("calcularSemaforo", () => {
  it("es verde y sin motivos cuando todo está en orden", () => {
    expect(con({})).toEqual({ color: "verde", motivos: [] });
  });

  it.each([
    ["el CI de main falla", { ciMain: "fallo" }, "ci_falla"],
    [
      "hay un incidente abierto",
      { incidenteAbierto: true },
      "incidente_abierto",
    ],
    [
      "la disponibilidad es menor al 99 %",
      { disponibilidad24h: 0.989 },
      "disponibilidad_baja",
    ],
  ] as const)("es rojo si %s", (_caso, cambios, regla) => {
    const r = con(cambios);
    expect(r.color).toBe("rojo");
    expect(r.motivos.map((m) => m.regla)).toEqual([regla]);
  });

  it.each([
    [
      "la checklist está incompleta",
      { checklistCompleta: false },
      "checklist_incompleta",
    ],
    ["el p95 supera el máximo", { latenciaP95Ms: 801 }, "latencia_alta"],
    [
      "el último check tiene más de 45 min",
      { ultimoCheck: hace(46) },
      "monitor_atrasado",
    ],
    [
      "hay pocos checks",
      { checks24h: CHECKS_MINIMOS_24H - 1 },
      "datos_insuficientes",
    ],
    ["el CI sigue en curso", { ciMain: "en_curso" }, "datos_insuficientes"],
  ] as const)("es amarillo si %s", (_caso, cambios, regla) => {
    const r = con(cambios);
    expect(r.color).toBe("amarillo");
    expect(r.motivos.map((m) => m.regla)).toEqual([regla]);
  });

  it("los límites exactos no disparan la regla", () => {
    expect(
      con({
        disponibilidad24h: 0.99,
        latenciaP95Ms: 800,
        ultimoCheck: hace(45),
      }).color,
    ).toBe("verde");
  });

  it("sin datos nunca es verde", () => {
    const r = con({
      disponibilidad24h: null,
      checks24h: 0,
      latenciaP95Ms: null,
      ultimoCheck: null,
      ciMain: "desconocido",
    });
    expect(r.color).toBe("amarillo");
    expect(r.motivos[0]?.texto).toBe(
      "No hay datos suficientes: checks, estado del CI.",
    );
  });

  it("gana la regla más grave y se muestran todos los motivos, rojos primero", () => {
    const r = con({
      checklistCompleta: false,
      incidenteAbierto: true,
      latenciaP95Ms: 2000,
    });
    expect(r.color).toBe("rojo");
    expect(r.motivos.map((m) => m.color)).toEqual([
      "rojo",
      "amarillo",
      "amarillo",
    ]);
  });

  it("cada motivo explica el dato que lo causó", () => {
    expect(con({ disponibilidad24h: 0.9876 }).motivos[0]?.texto).toBe(
      "Disponibilidad de 24 h en 98.7 % (mínimo 99 %).",
    );
    expect(con({ ultimoCheck: hace(61) }).motivos[0]?.texto).toContain(
      "hace 61 min",
    );
  });

  it("no redondea hacia arriba una disponibilidad por debajo del mínimo", () => {
    // 98.96 % redondeado daría "99.0 %" junto a "mínimo 99 %": se trunca
    expect(con({ disponibilidad24h: 0.98996 }).motivos[0]?.texto).toContain(
      "98.9 %",
    );
  });
});
