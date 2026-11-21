import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/status/[slug]/route";
import { getDb } from "@/lib/db/client";
import {
  checks,
  endpoints,
  incidents,
  products,
  rateLimits,
} from "@/lib/db/schema";

const db = getDb();
const openapi = JSON.parse(readFileSync("public/openapi.json", "utf8"));
const esquema = openapi.components.schemas.Estado;

const pedir = (slug: string, ip = "203.0.113.7") =>
  GET(
    new Request(`http://localhost/api/status/${slug}`, {
      headers: { "x-forwarded-for": ip },
    }),
    { params: Promise.resolve({ slug }) } as never,
  );

async function crear(slug: string, publico: boolean) {
  const [p] = await db
    .insert(products)
    .values({
      name: "Producto",
      slug,
      repo: "dueno-secreto/repo-privado",
      isPublic: publico,
    })
    .returning();
  const [e] = await db
    .insert(endpoints)
    .values({
      productId: p!.id,
      url: "https://interno.secreto.example/salud",
    })
    .returning();
  await db.insert(checks).values({
    endpointId: e!.id,
    checkedAt: new Date(Date.now() - 60_000),
    ok: false,
    status: 500,
    latencyMs: 100,
    error: "connect ECONNREFUSED 10.0.0.5:443",
  });
  await db.insert(incidents).values({
    endpointId: e!.id,
    openedAt: new Date(Date.now() - 30 * 60_000),
    reason: "interno.secreto.example respondió 500",
  });
}

describe("GET /api/status/[slug]", () => {
  beforeEach(async () => {
    await db.delete(products);
    await db.delete(rateLimits);
  });

  it("público: 200 con las propiedades exactas del OpenAPI y sin datos internos", async () => {
    await crear("publico", true);
    const res = await pedir("publico");
    const texto = await res.text();
    const cuerpo = JSON.parse(texto);

    expect(res.status).toBe(200);
    expect(Object.keys(cuerpo).sort()).toEqual([...esquema.required].sort());
    expect(Object.keys(cuerpo).sort()).toEqual(
      Object.keys(esquema.properties).sort(),
    );
    const itemIncidente = esquema.properties.incidentes.items;
    expect(cuerpo.incidentes).toHaveLength(1);
    expect(Object.keys(cuerpo.incidentes[0]).sort()).toEqual(
      [...itemIncidente.required].sort(),
    );
    expect(cuerpo.estado).toBe("incidente");
    expect(esquema.properties.estado.enum).toContain(cuerpo.estado);

    expect(texto).not.toMatch(
      /secreto|dueno|repo-privado|ECONNREFUSED|10\.0\.0\.5/,
    );
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=60, s-maxage=60",
    );
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("privado e inexistente: 404 con el mismo cuerpo", async () => {
    await crear("privado", false);
    const a = await pedir("privado");
    const b = await pedir("no-existe");

    expect(a.status).toBe(404);
    expect(b.status).toBe(404);
    expect(await a.json()).toEqual({ error: "No encontrado" });
    expect(await b.json()).toEqual({ error: "No encontrado" });
  });

  it("429 con Retry-After al pasar de 60 por minuto por IP", async () => {
    for (let i = 0; i < 60; i++)
      expect((await pedir("no-existe", "198.51.100.1")).status).toBe(404);
    const res = await pedir("no-existe", "198.51.100.1");
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(await res.json()).toEqual({ error: "Demasiadas peticiones" });
    // otra IP no se ve afectada
    expect((await pedir("no-existe", "198.51.100.2")).status).toBe(404);
  });
});
