import type { Account } from "next-auth";
import { describe, expect, it } from "vitest";
import { type BuscarMiembro, callbacks, DEMO_ID } from "@/lib/auth/opciones";
import { puedeEscribir, type SesionSemaforo } from "@/lib/auth/sesion";

const miembros: Record<number, { rol: "admin" | "lector"; login: string }> = {
  1: { rol: "admin", login: "maxacosta-30" },
  2: { rol: "lector", login: "colega" },
};
const buscar: BuscarMiembro = async (id) => miembros[id] ?? null;
const cb = callbacks(buscar);
const github = (id: number) =>
  ({
    provider: "github",
    providerAccountId: String(id),
    type: "oauth",
  }) as Account;
const demo = {
  provider: DEMO_ID,
  providerAccountId: "demo",
  type: "credentials",
} as Account;
const llamarSignIn = (account: Account | null) =>
  cb.signIn!({ account, user: { id: "x" } } as never);

describe("caso 1 · solo entran miembros", () => {
  it("deja entrar a un miembro de GitHub", async () => {
    expect(await llamarSignIn(github(1))).toBe(true);
  });

  it("rechaza a una cuenta de GitHub que no está en members", async () => {
    expect(await llamarSignIn(github(99))).toBe(false);
  });

  it("rechaza cualquier otro proveedor", async () => {
    expect(
      await llamarSignIn({
        provider: "otro",
        providerAccountId: "1",
        type: "oauth",
      } as Account),
    ).toBe(false);
    expect(await llamarSignIn(null)).toBe(false);
  });

  it("el token lleva el rol del miembro", async () => {
    const t = await cb.jwt!({ token: {}, account: github(2) } as never);
    expect(t).toMatchObject({ rol: "lector", demo: false, login: "colega" });
  });
});

describe("caso 9 · entrar como demo", () => {
  it("la demo entra como lector", async () => {
    expect(await llamarSignIn(demo)).toBe(true);
    expect(await cb.jwt!({ token: {}, account: demo } as never)).toMatchObject({
      rol: "lector",
      demo: true,
    });
  });
});

describe("permisos de escritura", () => {
  const sesion = (rol: "admin" | "lector", esDemo = false) =>
    ({ rol, demo: esDemo, login: "x", expires: "" }) as SesionSemaforo;

  it("solo el administrador escribe; lector, demo y sin sesión no", () => {
    expect(puedeEscribir(sesion("admin"))).toBe(true);
    expect(puedeEscribir(sesion("lector"))).toBe(false);
    expect(puedeEscribir(sesion("admin", true))).toBe(false); // una demo nunca escribe
    expect(puedeEscribir(null)).toBe(false);
  });
});
