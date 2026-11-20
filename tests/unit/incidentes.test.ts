import { describe, expect, it } from "vitest";
import {
  ESTADO_INICIAL,
  type EventoIncidente,
  registrarCheck,
} from "@/lib/domain/incidentes";

function secuencia(resultados: boolean[]): EventoIncidente[] {
  let estado = ESTADO_INICIAL;
  return resultados.map((ok) => {
    const r = registrarCheck(estado, ok);
    estado = r.estado;
    return r.evento;
  });
}

describe("incidentes", () => {
  it("se abre al tercer fallo seguido, no antes", () => {
    expect(secuencia([false, false, false])).toEqual([null, null, "abrir"]);
  });

  it("un éxito entre fallos reinicia la cuenta", () => {
    expect(secuencia([false, false, true, false, false])).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("se cierra tras 2 éxitos seguidos y no vuelve a abrir con un fallo suelto", () => {
    expect(secuencia([false, false, false, true, true, false])).toEqual([
      null,
      null,
      "abrir",
      null,
      "cerrar",
      null,
    ]);
  });

  it("un fallo entre éxitos mantiene el incidente abierto", () => {
    expect(secuencia([false, false, false, true, false, true, true])).toEqual([
      null,
      null,
      "abrir",
      null,
      null,
      null,
      "cerrar",
    ]);
  });

  it("seguir fallando con el incidente abierto no abre otro", () => {
    expect(secuencia([false, false, false, false, false])).toEqual([
      null,
      null,
      "abrir",
      null,
      null,
    ]);
  });
});
