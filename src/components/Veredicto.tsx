import type { Color } from "@/lib/domain/semaforo";
import { IconoAlto, IconoOk, IconoPrecaucion } from "./Iconos";
import estilos from "./panel.module.css";

export const TEXTO_COLOR: Record<Color, string> = {
  verde: "Verde · vía libre",
  amarillo: "Amarillo · precaución",
  rojo: "Rojo · alto",
};

export function Icono({ color }: { color: Color }) {
  return color === "verde" ? (
    <IconoOk />
  ) : color === "amarillo" ? (
    <IconoPrecaucion />
  ) : (
    <IconoAlto />
  );
}

export function Veredicto({ color, texto }: { color: Color; texto?: string }) {
  return (
    <p className={`${estilos.veredicto} ${estilos[color]}`}>
      <Icono color={color} /> {texto ?? TEXTO_COLOR[color]}
    </p>
  );
}
