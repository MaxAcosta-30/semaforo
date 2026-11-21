import { eq } from "drizzle-orm";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { getDb } from "@/lib/db/client";
import { endpoints, incidents, monitorRuns, products } from "@/lib/db/schema";
import { ejecutarMonitor } from "@/lib/monitor/ejecutar";
import type { Peticion } from "@/lib/monitor/peticion";
import type { Resolver } from "@/lib/monitor/ssrf";

const db = getDb();
const WEBHOOK = "https://discord.com/api/webhooks/123/token-secreto";
const publico: Resolver = async () => ["93.184.215.14"];
const responde =
  (status: number): Peticion =>
  async () => ({ status, latenciaMs: 120, error: null });

let reloj = new Date("2026-11-19T12:00:00Z");
const ahora = () => new Date(reloj);
const avanzar = () => (reloj = new Date(reloj.getTime() + 15 * 60_000));
const corrida = (status: number) => {
  avanzar();
  return ejecutarMonitor(db, {
    ahora,
    resolver: publico,
    peticion: responde(status),
  });
};

let mensajes: string[] = [];
let respuesta: () => Response | Promise<Response> = () =>
  new HttpResponse(null, { status: 204 });

const servidor = setupServer(
  http.post(WEBHOOK, async ({ request }) => {
    const cuerpo = (await request.json()) as { content: string };
    mensajes.push(cuerpo.content);
    return respuesta();
  }),
);

async function crearEndpoint() {
  const [producto] = await db
    .insert(products)
    .values({ name: "Hito", slug: "hito-alertas", repo: "dueno/repo" })
    .returning();
  const [ep] = await db
    .insert(endpoints)
    .values({
      productId: producto!.id,
      url: "https://api.ejemplo.com/salud?token=oculto",
    })
    .returning();
  return ep!;
}

describe("alertas de incidentes a Discord", () => {
  beforeAll(() => servidor.listen({ onUnhandledFrame: "error" }));
  afterAll(() => servidor.close());
  beforeEach(async () => {
    reloj = new Date("2026-11-19T12:00:00Z");
    mensajes = [];
    respuesta = () => new HttpResponse(null, { status: 204 });
    vi.stubEnv("DISCORD_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("APP_URL", "https://semaforo.ejemplo.com");
    await db.delete(products);
    await db.delete(monitorRuns);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    servidor.resetHandlers();
    await db.delete(products);
    await db.delete(monitorRuns);
  });

  it("envía una alerta al abrirse y ninguna mientras sigue abierto", async () => {
    await crearEndpoint();
    await corrida(503);
    await corrida(503);
    expect(mensajes).toHaveLength(0);
    await corrida(503);
    expect(mensajes).toHaveLength(1);
    expect(mensajes[0]).toContain("Incidente abierto en Hito");
    expect(mensajes[0]).toContain("api.ejemplo.com/salud");
    expect(mensajes[0]).toContain("Respondió 503");
    expect(mensajes[0]).toContain(
      "https://semaforo.ejemplo.com/productos/hito-alertas",
    );
    expect(mensajes[0]).not.toContain("token=oculto");

    await corrida(503);
    expect(mensajes).toHaveLength(1);
  });

  it("envía una alerta de cierre con la duración", async () => {
    await crearEndpoint();
    for (let i = 0; i < 3; i++) await corrida(503);
    await corrida(200);
    expect(mensajes).toHaveLength(1);
    await corrida(200);
    expect(mensajes).toHaveLength(2);
    expect(mensajes[1]).toContain("Incidente cerrado en Hito");
    expect(mensajes[1]).toContain("Duración: 30 min");
  });

  it("sin DISCORD_WEBHOOK_URL no envía nada", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_URL", "");
    await crearEndpoint();
    for (let i = 0; i < 3; i++) await corrida(503);
    expect(mensajes).toHaveLength(0);
    expect(await db.select().from(incidents)).toHaveLength(1);
  });

  it.each([
    ["Discord responde 500", () => new HttpResponse(null, { status: 500 })],
    ["error de red", () => HttpResponse.error()],
  ])(
    "%s: la corrida termina bien y el incidente queda guardado",
    async (_n, r) => {
      respuesta = r;
      const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
      const ep = await crearEndpoint();
      await corrida(503);
      await corrida(503);
      const tercera = await corrida(503);

      expect(tercera.incidentesAbiertos).toBe(1);
      expect(
        await db
          .select()
          .from(incidents)
          .where(eq(incidents.endpointId, ep.id)),
      ).toHaveLength(1);
      expect(await db.select().from(monitorRuns)).toHaveLength(3);
      expect(aviso).toHaveBeenCalled();
      expect(JSON.stringify(aviso.mock.calls)).not.toContain("token-secreto");
    },
  );

  it("un timeout no rompe la corrida", async () => {
    // Se acorta el plazo de 5 s para no esperar en la prueba.
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.timeout(50));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    respuesta = async () => {
      await new Promise((r) => setTimeout(r, 1000));
      return new HttpResponse(null, { status: 204 });
    };
    await crearEndpoint();
    await corrida(503);
    await corrida(503);
    const tercera = await corrida(503);
    expect(tercera.incidentesAbiertos).toBe(1);
    expect(await db.select().from(incidents)).toHaveLength(1);
  });

  it.each([
    "http://discord.com/api/webhooks/1/x",
    "https://ejemplo.com/api/webhooks/1/x",
    "https://discord.com.malo.com/api/webhooks/1/x",
    "https://discord.com/otra/ruta",
    "no es una url",
  ])("ignora una URL que no es de Discord: %s", async (url) => {
    vi.stubEnv("DISCORD_WEBHOOK_URL", url);
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    await crearEndpoint();
    for (let i = 0; i < 3; i++) await corrida(503);
    expect(mensajes).toHaveLength(0);
    expect(aviso).toHaveBeenCalled();
    expect(JSON.stringify(aviso.mock.calls)).not.toContain(url);
  });
});
