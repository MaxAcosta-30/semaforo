import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { checks, endpoints, incidents, products } from "@/lib/db/schema";
import { estadoDeProducto, porcentaje } from "@/lib/estado/producto";

const db = getDb();
const AHORA = new Date("2026-11-19T12:00:00Z");
const haceMin = (m: number) => new Date(AHORA.getTime() - m * 60_000);

async function producto(publico = true) {
  const [p] = await db
    .insert(products)
    .values({
      name: "Hito",
      slug: `hito-${crypto.randomUUID()}`,
      repo: "MaxAcosta-30/hito",
      isPublic: publico,
    })
    .returning();
  const [e] = await db
    .insert(endpoints)
    .values({
      productId: p!.id,
      url: "https://hito.ejemplo.com/salud",
      maxLatencyMs: 800,
    })
    .returning();
  return { p: p!, e: e! };
}

/** Un check cada 15 min durante 24 h (96), todos bien salvo lo que diga `fallo`. */
async function historia(
  endpointId: string,
  fallo: (i: number) => boolean = () => false,
  latencia = 200,
) {
  await db
    .insert(checks)
    .values(
      Array.from({ length: 96 }, (_, i) => ({
        endpointId,
        checkedAt: haceMin(i * 15 + 1),
        ok: !fallo(i),
        status: fallo(i) ? 500 : 200,
        latencyMs: latencia,
      })),
    );
}

describe("estadoDeProducto", () => {
  beforeEach(async () => {
    await db.delete(products);
  });

  it("producto sano con CI en éxito: verde, vía completa y 100 %", async () => {
    const { p, e } = await producto();
    await historia(e.id);
    const r = await estadoDeProducto(db, p.slug, {
      ahora: AHORA,
      ci: async () => "exito",
    });

    expect(r?.semaforo).toEqual({ color: "verde", motivos: [] });
    expect(r?.publico).toBe("normal");
    expect(r?.bloques).toEqual(Array(24).fill("ok"));
    expect(porcentaje(r!.disponibilidad24h)).toBe("100.0 %");
  });

  it("sin CI conocido nunca es verde", async () => {
    const { p, e } = await producto();
    await historia(e.id);
    const r = await estadoDeProducto(db, p.slug, { ahora: AHORA });
    expect(r?.semaforo.color).toBe("amarillo");
    expect(r?.semaforo.motivos[0]?.regla).toBe("datos_insuficientes");
  });

  it("fallos recientes: rojo por disponibilidad, bloques de falla y estado degradado", async () => {
    const { p, e } = await producto();
    await historia(e.id, (i) => i < 2); // los 2 checks más recientes fallan
    const r = await estadoDeProducto(db, p.slug, {
      ahora: AHORA,
      ci: async () => "exito",
    });

    expect(r?.semaforo.color).toBe("rojo");
    expect(r?.semaforo.motivos.map((m) => m.regla)).toContain(
      "disponibilidad_baja",
    );
    expect(r?.bloques.at(-1)).toBe("falla");
    expect(r?.publico).toBe("degradado");
  });

  it("un incidente abierto pone la página pública en incidente", async () => {
    const { p, e } = await producto();
    await historia(e.id);
    await db
      .insert(incidents)
      .values({
        endpointId: e.id,
        openedAt: haceMin(30),
        reason: "Respondió 503",
      });
    const r = await estadoDeProducto(db, p.slug, {
      ahora: AHORA,
      ci: async () => "exito",
    });

    expect(r?.publico).toBe("incidente");
    expect(r?.incidentes).toHaveLength(1);
    expect(r?.semaforo.color).toBe("rojo");
  });

  it("latencia sobre el máximo del endpoint: bloques lentos y amarillo con su motivo", async () => {
    const { p, e } = await producto();
    await historia(e.id, () => false, 1200);
    const r = await estadoDeProducto(db, p.slug, {
      ahora: AHORA,
      ci: async () => "exito",
    });

    expect(r?.p95).toEqual({ ms: 1200, maximo: 800 });
    expect(r?.bloques.every((b) => b === "lento")).toBe(true);
    expect(r?.semaforo.color).toBe("amarillo");
  });

  it("sin checks: bloques sin datos y estado público sin datos", async () => {
    const { p } = await producto();
    const r = await estadoDeProducto(db, p.slug, { ahora: AHORA });
    expect(r?.publico).toBe("sin-datos");
    expect(r?.bloques).toEqual(Array(24).fill("sin-datos"));
  });

  it("si el CI no se puede consultar, cuenta como desconocido (no rompe la página)", async () => {
    const { p, e } = await producto();
    await historia(e.id);
    const r = await estadoDeProducto(db, p.slug, {
      ahora: AHORA,
      ci: async () => {
        throw new Error("GitHub caído");
      },
    });
    expect(
      r?.semaforo.motivos.some((m) => m.texto.includes("estado del CI")),
    ).toBe(true);
  });

  it("un slug que no existe devuelve null", async () => {
    expect(
      await estadoDeProducto(db, "no-existe", { ahora: AHORA }),
    ).toBeNull();
  });
});
