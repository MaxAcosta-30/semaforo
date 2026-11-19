import { describe, expect, it } from "vitest";
import { isMonitorAuthorized } from "@/lib/monitor/auth";

const SECRET = "secreto-de-prueba-con-longitud-suficiente";

describe("isMonitorAuthorized", () => {
  it("acepta el secreto correcto", () => {
    expect(isMonitorAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it.each([
    ["sin encabezado", null],
    ["secreto incorrecto", "Bearer otro"],
    ["secreto con un carácter de más", `Bearer ${SECRET}x`],
    ["sin el prefijo Bearer", SECRET],
    ["Bearer vacío", "Bearer "],
  ])("rechaza %s", (_caso, header) => {
    expect(isMonitorAuthorized(header, SECRET)).toBe(false);
  });

  it("rechaza todo si MONITOR_SECRET no está configurado", () => {
    expect(isMonitorAuthorized("Bearer ", undefined)).toBe(false);
    expect(isMonitorAuthorized("Bearer ", "")).toBe(false);
  });
});
