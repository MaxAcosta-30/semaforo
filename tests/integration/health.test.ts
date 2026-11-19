import { describe, expect, it, vi } from "vitest";

// connection() solo funciona dentro de una petición de Next; aquí no aporta nada.
vi.mock("next/server", () => ({ connection: async () => {} }));

const { GET } = await import("@/app/api/health/route");

describe("GET /api/health", () => {
  it("responde 200 cuando PostgreSQL contesta", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: "ok" });
  });
});
