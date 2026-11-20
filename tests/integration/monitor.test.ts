import { eq, isNull } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db/client";
import {
  checks,
  endpoints,
  incidents,
  monitorRuns,
  products,
} from "@/lib/db/schema";
import { CONCURRENCIA, ejecutarMonitor } from "@/lib/monitor/ejecutar";
import type { Peticion } from "@/lib/monitor/peticion";
import type { Resolver } from "@/lib/monitor/ssrf";

const db = getDb();
const publico: Resolver = async () => ["93.184.215.14"];
const responde =
  (status: number): Peticion =>
  async () => ({ status, latenciaMs: 120, error: null });

let reloj = new Date("2026-11-19T12:00:00Z");
const ahora = () => new Date(reloj);
const avanzar = () => (reloj = new Date(reloj.getTime() + 15 * 60_000));

async function crearEndpoints(urls: string[]) {
  const [producto] = await db
    .insert(products)
    .values({
      name: "Prueba",
      slug: `prueba-${crypto.randomUUID()}`,
      repo: "dueno/repo",
    })
    .returning();
  return db
    .insert(endpoints)
    .values(urls.map((url) => ({ productId: producto!.id, url })))
    .returning();
}

describe("ejecutarMonitor", () => {
  beforeEach(async () => {
    reloj = new Date("2026-11-19T12:00:00Z");
    // Otros archivos (la ruta del monitor) también escriben en monitor_runs
    await db.delete(products);
    await db.delete(monitorRuns);
  });
  afterEach(async () => {
    await db.delete(products); // en cascada: endpoints, checks e incidentes
    await db.delete(monitorRuns);
  });

  it("guarda un check por endpoint y registra la corrida", async () => {
    await crearEndpoints([
      "https://a.ejemplo.com/salud",
      "https://b.ejemplo.com/salud",
    ]);
    const r = await ejecutarMonitor(db, {
      ahora,
      resolver: publico,
      peticion: responde(200),
    });

    expect(r).toEqual({
      revisados: 2,
      fallidos: 0,
      incidentesAbiertos: 0,
      incidentesCerrados: 0,
    });
    const guardados = await db.select().from(checks);
    expect(
      guardados.map((c) => [c.ok, c.status, c.latencyMs, c.error]),
    ).toEqual([
      [true, 200, 120, null],
      [true, 200, 120, null],
    ]);
    expect(await db.select().from(monitorRuns)).toHaveLength(1);
  });

  it("un código distinto al esperado es un fallo con su motivo", async () => {
    await crearEndpoints(["https://a.ejemplo.com/salud"]);
    await ejecutarMonitor(db, {
      ahora,
      resolver: publico,
      peticion: responde(503),
    });

    const [check] = await db.select().from(checks);
    expect(check).toMatchObject({
      ok: false,
      status: 503,
      error: "Respondió 503; se esperaba 200",
    });
  });

  it("una URL que ahora resuelve a la red interna se bloquea sin hacer la petición", async () => {
    await crearEndpoints(["https://cambio.ejemplo.com/salud"]);
    const peticion = vi.fn(responde(200));
    await ejecutarMonitor(db, {
      ahora,
      resolver: async () => ["10.0.0.7"],
      peticion,
    });

    expect(peticion).not.toHaveBeenCalled();
    const [check] = await db.select().from(checks);
    expect(check?.error).toBe(
      "URL bloqueada: La URL apunta a una red privada o reservada.",
    );
  });

  it("abre un incidente al tercer fallo, no duplica y lo cierra con dos éxitos", async () => {
    const [ep] = await crearEndpoints(["https://a.ejemplo.com/salud"]);
    const corrida = async (status: number) => {
      avanzar();
      return ejecutarMonitor(db, {
        ahora,
        resolver: publico,
        peticion: responde(status),
      });
    };

    expect((await corrida(500)).incidentesAbiertos).toBe(0);
    expect((await corrida(500)).incidentesAbiertos).toBe(0);
    expect((await corrida(500)).incidentesAbiertos).toBe(1);
    expect((await corrida(500)).incidentesAbiertos).toBe(0); // sigue el mismo incidente
    expect((await corrida(200)).incidentesCerrados).toBe(0);
    expect((await corrida(200)).incidentesCerrados).toBe(1);

    const todos = await db
      .select()
      .from(incidents)
      .where(eq(incidents.endpointId, ep!.id));
    expect(todos).toHaveLength(1);
    expect(todos[0]?.reason).toBe("Respondió 500; se esperaba 200");
    expect(
      await db.select().from(incidents).where(isNull(incidents.closedAt)),
    ).toHaveLength(0);
  });

  it("revisa todos los endpoints aunque sean más que la concurrencia", async () => {
    const urls = Array.from(
      { length: CONCURRENCIA * 2 + 1 },
      (_, i) => `https://e${i}.ejemplo.com/`,
    );
    await crearEndpoints(urls);
    const r = await ejecutarMonitor(db, {
      ahora,
      resolver: publico,
      peticion: responde(200),
    });
    expect(r.revisados).toBe(urls.length);
  });
});
