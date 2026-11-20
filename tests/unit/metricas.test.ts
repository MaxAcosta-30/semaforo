import { describe, expect, it } from "vitest";
import {
  type Check,
  contarEnVentana,
  disponibilidad,
  p95,
  p95EnVentana,
  VENTANA_24H_MS,
  VENTANA_7D_MS,
} from "@/lib/domain/metricas";

const AHORA = new Date("2026-11-19T12:00:00Z");
const check = (
  horasAtras: number,
  ok: boolean,
  latenciaMs: number | null = 200,
): Check => ({
  at: new Date(AHORA.getTime() - horasAtras * 3_600_000),
  ok,
  latenciaMs,
});

describe("p95", () => {
  it("usa el rango más cercano: con 20 valores es el 19.º", () => {
    const valores = Array.from({ length: 20 }, (_, i) => (i + 1) * 10);
    expect(p95(valores)).toBe(190);
  });

  it("con un solo valor es ese valor y sin valores es null", () => {
    expect(p95([123])).toBe(123);
    expect(p95([])).toBeNull();
  });

  it("no depende del orden de entrada", () => {
    expect(p95([900, 100, 300, 200, 500])).toBe(900);
  });
});

describe("disponibilidad", () => {
  const checks = [
    check(1, true),
    check(2, false),
    check(3, true),
    check(30, false),
  ];

  it("cuenta solo los checks de la ventana", () => {
    expect(disponibilidad(checks, AHORA, VENTANA_24H_MS)).toBeCloseTo(2 / 3);
    expect(disponibilidad(checks, AHORA, VENTANA_7D_MS)).toBe(0.5);
    expect(contarEnVentana(checks, AHORA, VENTANA_24H_MS)).toBe(3);
  });

  it("sin checks es null, no 0 ni 100 %", () => {
    expect(disponibilidad([], AHORA, VENTANA_24H_MS)).toBeNull();
  });

  it("el borde de la ventana: exactamente hace 24 h queda fuera", () => {
    expect(contarEnVentana([check(24, true)], AHORA, VENTANA_24H_MS)).toBe(0);
  });
});

describe("p95EnVentana", () => {
  it("ignora fallos y timeouts: esos ya cuentan en la disponibilidad", () => {
    const checks = [
      check(1, true, 100),
      check(2, false, 9000),
      check(3, true, null),
    ];
    expect(p95EnVentana(checks, AHORA, VENTANA_24H_MS)).toBe(100);
  });
});
