import Link from "next/link";
import { Salir } from "./BotonesSesion";
import { getDb } from "@/lib/db/client";
import { estadoDelMonitor } from "@/lib/monitor/estado";
import estilos from "./panel.module.css";

/** Encabezado tipo placa de estación con el estado del monitor (caso 9: avisa si se detuvo). */
export async function Placa({ quien }: { quien: string }) {
  const { minutos, atrasado } = await estadoDelMonitor(getDb());
  return (
    <header className={estilos.placa}>
      <div className={estilos.placaDentro}>
        <Link className={estilos.marca} href="/">
          Semáforo
        </Link>
        <p className={estilos.monitor} role="status">
          <span
            className={`${estilos.punto} ${atrasado ? estilos.puntoAtrasado : ""}`}
            aria-hidden="true"
          />
          {minutos === null
            ? "El monitor todavía no ha corrido"
            : atrasado
              ? `El monitor no corre desde hace ${minutos} min`
              : `Monitor al día · último check hace ${minutos} min`}
        </p>
        <span className={estilos.motivo}>{quien}</span>
        <Salir />
      </div>
    </header>
  );
}
