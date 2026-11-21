import { describe, expect, it } from "vitest";
import { esquemaProducto, slugDesde } from "@/lib/productos/esquema";

describe("slugDesde", () => {
  it("quita acentos y pasa a minúsculas con guiones", () => {
    expect(slugDesde("Tienda Demo Ñandú")).toBe("tienda-demo-nandu");
  });
  it("colapsa espacios y símbolos repetidos", () => {
    expect(slugDesde("Mi   tienda -- (beta) !!")).toBe("mi-tienda-beta");
  });
  it("no deja guiones al inicio ni al final", () => {
    expect(slugDesde("  --Hito--  ")).toBe("hito");
  });
  it("corta a 60 sin terminar en guion", () => {
    const s = slugDesde(`${"a".repeat(59)} b`);
    expect(s).toBe("a".repeat(59));
    expect(slugDesde("x".repeat(100))).toHaveLength(60);
  });
  it("sin letras ni números queda vacío", () => {
    expect(slugDesde("¡¡!!")).toBe("");
  });
});

describe("esquemaProducto", () => {
  it("rechaza el slug reservado «nuevo»", () => {
    const r = esquemaProducto.safeParse({
      nombre: "X",
      slug: "nuevo",
      repo: "a/b",
      endpoints: [{ url: "https://x.com" }],
    });
    expect(r.success).toBe(false);
  });
});
