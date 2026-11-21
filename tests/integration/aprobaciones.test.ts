import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aprobar, CHECKLIST, checklistDe, marcar } from "@/lib/aprobaciones";
import { getDb } from "@/lib/db/client";
import { products, releaseApprovals } from "@/lib/db/schema";
import type { ResultadoSemaforo } from "@/lib/domain/semaforo";

const sesionActual = vi.hoisted(() => ({ valor: null as unknown }));
vi.mock("@/lib/auth/sesion", async (original) => ({
  ...(await original<typeof import("@/lib/auth/sesion")>()),
  obtenerSesion: async () => sesionActual.valor,
}));
const { POST: marcarRuta } =
  await import("@/app/api/productos/[slug]/checklist/route");
const { POST: aprobarRuta } =
  await import("@/app/api/productos/[slug]/aprobar/route");

const db = getDb();
const verde: ResultadoSemaforo = { color: "verde", motivos: [] };
const rojo: ResultadoSemaforo = {
  color: "rojo",
  motivos: [
    {
      color: "rojo",
      regla: "incidente_abierto",
      texto: "Hay un incidente abierto.",
    },
  ],
};
let id = "";
const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe("caso 6 · checklist y aprobación", () => {
  beforeEach(async () => {
    await db.delete(products);
    const [p] = await db
      .insert(products)
      .values({
        name: "Hito",
        slug: "hito-6",
        repo: "MaxAcosta-30/hito",
        versionCandidata: "v2.3.0",
      })
      .returning();
    id = p!.id;
  });
  afterEach(() => {
    sesionActual.valor = null;
  });

  it("la checklist se marca por versión y guarda quién marcó", async () => {
    for (const item of CHECKLIST)
      await marcar(db, id, "v2.3.0", item, true, "maxacosta-30");
    expect((await checklistDe(db, id, "v2.3.0")).completa).toBe(true);
    expect((await checklistDe(db, id, "v2.4.0")).completa).toBe(false); // otra versión empieza vacía
    await marcar(db, id, "v2.3.0", CHECKLIST[0], false, "maxacosta-30");
    const c = await checklistDe(db, id, "v2.3.0");
    expect(c.completa).toBe(false);
    expect(c.renglones[1]?.por).toBe("maxacosta-30");
  });

  it("un renglón que no es de la checklist se rechaza", async () => {
    expect((await marcar(db, id, "v2.3.0", "Inventado", true, "x")).ok).toBe(
      false,
    );
  });

  it("aprobar guarda quién, cuándo y el color con sus motivos", async () => {
    const cuando = new Date("2026-11-19T20:00:00Z");
    const r = await aprobar(db, id, "v2.3.0", verde, "maxacosta-30", cuando);
    expect(r.ok).toBe(true);
    const [fila] = await db
      .select()
      .from(releaseApprovals)
      .where(eq(releaseApprovals.productId, id));
    expect(fila).toMatchObject({
      version: "v2.3.0",
      aprobadoPor: "maxacosta-30",
      color: "verde",
      motivos: [],
    });
    expect(fila?.aprobadoAt).toEqual(cuando);
  });

  it("con rojo no se puede aprobar", async () => {
    const r = await aprobar(db, id, "v2.3.0", rojo, "maxacosta-30");
    expect(r).toMatchObject({ ok: false, estado: 409 });
    expect(await db.select().from(releaseApprovals)).toHaveLength(0);
  });

  it("una versión se aprueba una sola vez", async () => {
    await aprobar(db, id, "v2.3.0", verde, "a");
    expect(await aprobar(db, id, "v2.3.0", verde, "b")).toMatchObject({
      ok: false,
      estado: 409,
    });
  });

  it.each([
    ["sin sesión", null, 401],
    ["un lector", { rol: "lector", demo: false, login: "colega" }, 403],
    ["la demo", { rol: "lector", demo: true, login: "demo" }, 403],
  ])("%s no marca ni aprueba", async (_q, sesion, estado) => {
    sesionActual.valor = sesion;
    const marcarR = await marcarRuta(
      new Request("http://x/", {
        method: "POST",
        body: JSON.stringify({ item: CHECKLIST[0], marcado: true }),
      }),
      ctx("hito-6"),
    );
    const aprobarR = await aprobarRuta(
      new Request("http://x/", { method: "POST" }),
      ctx("hito-6"),
    );
    expect([marcarR.status, aprobarR.status]).toEqual([estado, estado]);
  });

  it("el admin marca por la ruta y la marca queda con su login", async () => {
    sesionActual.valor = { rol: "admin", demo: false, login: "maxacosta-30" };
    const r = await marcarRuta(
      new Request("http://x/", {
        method: "POST",
        body: JSON.stringify({ item: CHECKLIST[2], marcado: true }),
      }),
      ctx("hito-6"),
    );
    expect(r.status).toBe(204);
    expect((await checklistDe(db, id, "v2.3.0")).renglones[2]).toMatchObject({
      marcado: true,
      por: "maxacosta-30",
    });
  });
});
