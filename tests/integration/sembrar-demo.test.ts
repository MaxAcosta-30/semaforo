import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { endpoints, products } from "@/lib/db/schema";
import { sembrarDemo } from "@/lib/demo/sembrar";

const db = getDb();
const publico = async () => ["93.184.215.14"];

describe("sembrarDemo", () => {
  beforeEach(async () => {
    await db.delete(products);
  });

  it("correrla dos veces deja exactamente 3 productos públicos y 3 endpoints", async () => {
    const uno = await sembrarDemo(db, publico);
    const dos = await sembrarDemo(db, publico);

    expect(uno.every((r) => r.accion === "creado")).toBe(true);
    expect(dos.every((r) => r.accion === "actualizado")).toBe(true);
    const filas = await db.select().from(products);
    expect(filas.map((p) => p.slug).sort()).toEqual([
      "ejemplo-enciclopedia",
      "ejemplo-sitio",
      "hito",
    ]);
    expect(filas.every((p) => p.isPublic)).toBe(true);
    expect(filas.find((p) => p.slug === "hito")?.repo).toBe(
      "MaxAcosta-30/Hito",
    );
    expect(await db.select().from(endpoints)).toHaveLength(3);
  });

  it("rechaza una URL que resuelve a una IP privada (SSRF)", async () => {
    await expect(sembrarDemo(db, async () => ["10.0.0.1"])).rejects.toThrow();
    expect(await db.select().from(products)).toHaveLength(0);
  });
});
