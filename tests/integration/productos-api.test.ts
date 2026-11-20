import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db/client";
import { endpoints, products, rateLimits } from "@/lib/db/schema";
import { permitir } from "@/lib/limites";
import { registrarProducto } from "@/lib/productos/registro";

// La sesión se simula: el resto (ruta, Zod, SSRF, base) es real.
const sesionActual = vi.hoisted(() => ({ valor: null as unknown }));
vi.mock("@/lib/auth/sesion", async (original) => ({
  ...(await original<typeof import("@/lib/auth/sesion")>()),
  obtenerSesion: async () => sesionActual.valor,
}));
const { POST } = await import("@/app/api/productos/route");

const db = getDb();
const publico = async () => ["93.184.215.14"];
const valido = {
  nombre: "Hito",
  slug: "hito",
  repo: "MaxAcosta-30/hito",
  publico: true,
  endpoints: [{ url: "https://hito.ejemplo.com/salud", latenciaMaximaMs: 800 }],
};
const post = (cuerpo: unknown) =>
  POST(
    new Request("http://localhost/api/productos", {
      method: "POST",
      body: JSON.stringify(cuerpo),
      headers: { "content-type": "application/json" },
    }),
  );

describe("POST /api/productos (caso 2)", () => {
  beforeEach(async () => {
    await db.delete(products);
  });
  afterEach(() => {
    sesionActual.valor = null;
  });

  it("sin sesión responde 401", async () => {
    expect((await post(valido)).status).toBe(401);
  });

  it.each([
    ["un lector", { rol: "lector", demo: false }],
    ["la demo", { rol: "lector", demo: true }],
  ])("%s no puede registrar (403) y no se guarda nada", async (_q, sesion) => {
    sesionActual.valor = sesion;
    expect((await post(valido)).status).toBe(403);
    expect(await db.select().from(products)).toHaveLength(0);
  });

  it("los errores de forma responden 400 por campo", async () => {
    sesionActual.valor = { rol: "admin", demo: false };
    const r = await post({
      ...valido,
      slug: "Con Espacios",
      repo: "../../etc",
      endpoints: [],
    });
    expect(r.status).toBe(400);
    expect(Object.keys((await r.json()).errores).sort()).toEqual([
      "endpoints",
      "repo",
      "slug",
    ]);
  });
});

describe("registrarProducto", () => {
  beforeEach(async () => {
    await db.delete(products);
  });

  it("guarda el producto y sus endpoints en una transacción", async () => {
    const r = await registrarProducto(db, valido, publico);
    expect(r).toMatchObject({ ok: true, slug: "hito" });
    const eps = await db
      .select()
      .from(endpoints)
      .where(eq(endpoints.productId, (r as { id: string }).id));
    expect(eps.map((e) => [e.url, e.expectedStatus, e.maxLatencyMs])).toEqual([
      ["https://hito.ejemplo.com/salud", 200, 800],
    ]);
  });

  it("una URL interna se rechaza junto al campo, sin guardar nada (SSRF)", async () => {
    const r = await registrarProducto(
      db,
      {
        ...valido,
        endpoints: [{ url: "https://169.254.169.254/latest/meta-data/" }],
      },
      publico,
    );
    expect(r).toEqual({
      ok: false,
      estado: 400,
      errores: {
        "endpoints.0.url": "La URL apunta a una red privada o reservada.",
      },
    });
    expect(await db.select().from(products)).toHaveLength(0);
  });

  it("un slug repetido responde 409", async () => {
    await registrarProducto(db, valido, publico);
    const r = await registrarProducto(db, valido, publico);
    expect(r).toMatchObject({ ok: false, estado: 409 });
  });
});

describe("límite de intentos", () => {
  beforeEach(async () => {
    await db.delete(rateLimits);
  });

  it("permite hasta el máximo y vuelve a permitir al pasar la ventana", async () => {
    const t0 = new Date("2026-11-19T12:00:00Z");
    const resultados = [];
    for (let i = 0; i < 4; i++)
      resultados.push(await permitir(db, "demo:1.2.3.4", 3, 60_000, t0));
    expect(resultados).toEqual([true, true, true, false]);
    expect(await permitir(db, "demo:5.6.7.8", 3, 60_000, t0)).toBe(true); // otra IP, otra cuenta
    expect(
      await permitir(
        db,
        "demo:1.2.3.4",
        3,
        60_000,
        new Date(t0.getTime() + 61_000),
      ),
    ).toBe(true);
  });

  it("es atómico: 20 intentos simultáneos dejan pasar exactamente el máximo", async () => {
    const t0 = new Date("2026-11-19T12:00:00Z");
    const r = await Promise.all(
      Array.from({ length: 20 }, () =>
        permitir(db, "demo:9.9.9.9", 5, 60_000, t0),
      ),
    );
    expect(r.filter(Boolean)).toHaveLength(5);
  });
});
