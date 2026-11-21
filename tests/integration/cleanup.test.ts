import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/monitor/cleanup/route";
import { getDb } from "@/lib/db/client";
import { checks, endpoints, products } from "@/lib/db/schema";

const SECRET = "secreto-de-cron-con-longitud-suficiente";
const db = getDb();
const dias = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const llamar = (auth?: string) =>
  GET(
    new Request("http://localhost/api/monitor/cleanup", {
      headers: auth ? { authorization: auth } : {},
    }),
  );

describe("GET /api/monitor/cleanup", () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    await db.delete(products);
  });

  it("responde 401 sin CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    expect((await llamar()).status).toBe(401);
    expect((await llamar("Bearer otro")).status).toBe(401);
  });

  it("borra solo los checks de más de 30 días", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const [p] = await db
      .insert(products)
      .values({ name: "P", slug: "p-limpieza", repo: "d/r" })
      .returning();
    const [e] = await db
      .insert(endpoints)
      .values({ productId: p!.id, url: "https://a.ejemplo.com/" })
      .returning();
    await db.insert(checks).values([
      { endpointId: e!.id, checkedAt: dias(31), ok: true },
      { endpointId: e!.id, checkedAt: dias(29), ok: true },
      { endpointId: e!.id, checkedAt: dias(0), ok: false },
    ]);

    const res = await llamar(`Bearer ${SECRET}`);

    expect(await res.json()).toMatchObject({ deleted: 1 });
    expect(await db.select().from(checks)).toHaveLength(2);
  });
});
