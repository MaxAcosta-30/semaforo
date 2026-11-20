import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/monitor/run/route";

const SECRET = "secreto-de-prueba-con-longitud-suficiente";

const request = (authorization?: string) =>
  new Request("http://localhost/api/monitor/run", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });

describe("POST /api/monitor/run", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("responde 401 sin el secreto", async () => {
    vi.stubEnv("MONITOR_SECRET", SECRET);
    const res = await POST(request());
    expect(res.status).toBe(401);
  });

  it("responde 401 si el servidor no tiene MONITOR_SECRET", async () => {
    vi.stubEnv("MONITOR_SECRET", "");
    const res = await POST(request("Bearer "));
    expect(res.status).toBe(401);
  });

  it("responde 200 con el secreto correcto", async () => {
    vi.stubEnv("MONITOR_SECRET", SECRET);
    const res = await POST(request(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ checked: 0, failed: 0 });
  });
});
