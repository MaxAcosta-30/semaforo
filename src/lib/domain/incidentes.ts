// Caso 7: un incidente se abre tras 3 fallos seguidos y se cierra tras 2 éxitos seguidos.
// Máquina de estados pura por endpoint; el monitor guarda el estado y los eventos.

export const FALLOS_PARA_ABRIR = 3;
export const EXITOS_PARA_CERRAR = 2;

export interface EstadoIncidente {
  abierto: boolean;
  fallosSeguidos: number;
  exitosSeguidos: number;
}

export type EventoIncidente = "abrir" | "cerrar" | null;

export const ESTADO_INICIAL: EstadoIncidente = {
  abierto: false,
  fallosSeguidos: 0,
  exitosSeguidos: 0,
};

export function registrarCheck(
  estado: EstadoIncidente,
  ok: boolean,
): { estado: EstadoIncidente; evento: EventoIncidente } {
  const fallosSeguidos = ok ? 0 : estado.fallosSeguidos + 1;
  const exitosSeguidos = ok ? estado.exitosSeguidos + 1 : 0;

  if (!estado.abierto && fallosSeguidos >= FALLOS_PARA_ABRIR) {
    return {
      estado: { abierto: true, fallosSeguidos, exitosSeguidos },
      evento: "abrir",
    };
  }
  if (estado.abierto && exitosSeguidos >= EXITOS_PARA_CERRAR) {
    return {
      estado: { abierto: false, fallosSeguidos, exitosSeguidos },
      evento: "cerrar",
    };
  }
  return {
    estado: { abierto: estado.abierto, fallosSeguidos, exitosSeguidos },
    evento: null,
  };
}
