import estilos from "./Senal.module.css";

export type ColorSenal = "verde" | "amarillo" | "rojo" | null;

/** Señal de 3 lentes en orden ferroviario. Decorativa: el texto junto a ella lleva el significado. */
export function Senal({
  color,
  grande = false,
}: {
  color: ColorSenal;
  grande?: boolean;
}) {
  const clase = [
    estilos.senal,
    grande ? estilos.grande : "",
    color ? estilos[color] : "",
  ].join(" ");
  return (
    <div className={clase} aria-hidden="true">
      <span className={`${estilos.lente} ${estilos.r}`} />
      <span className={`${estilos.lente} ${estilos.a}`} />
      <span className={`${estilos.lente} ${estilos.v}`} />
    </div>
  );
}
