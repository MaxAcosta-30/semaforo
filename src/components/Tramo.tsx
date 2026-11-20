import type { Bloque } from "@/lib/estado/producto";
import estilos from "./Tramo.module.css";

const NOMBRE: Record<Bloque, string> = {
  ok: "sin fallos",
  lento: "latencia alta",
  falla: "con fallos",
  "sin-datos": "sin datos",
};
const CLASE: Record<Bloque, string> = {
  ok: "",
  lento: estilos.lento!,
  falla: estilos.falla!,
  "sin-datos": estilos.sinDatos!,
};

/** La firma del diseño: 24 bloques de 1 hora. El estado se lee por altura y color, y en el aria-label. */
export function Tramo({
  bloques,
  derecha = "ahora",
}: {
  bloques: Bloque[];
  derecha?: string;
}) {
  const resumen = Object.entries(
    bloques.reduce<Record<string, number>>(
      (a, b) => ((a[NOMBRE[b]] = (a[NOMBRE[b]] ?? 0) + 1), a),
      {},
    ),
  )
    .map(([k, n]) => `${n} ${k}`)
    .join(", ");
  return (
    <div>
      <div
        className={estilos.tramo}
        role="img"
        aria-label={`Últimas 24 horas: ${resumen}`}
      >
        {bloques.map((b, i) => (
          <span
            key={i}
            className={`${estilos.bloque} ${CLASE[b]}`}
            title={`hace ${24 - i} h: ${NOMBRE[b]}`}
          />
        ))}
      </div>
      <div className={estilos.leyenda}>
        <span>hace 24 h</span>
        <span>{derecha}</span>
      </div>
    </div>
  );
}
