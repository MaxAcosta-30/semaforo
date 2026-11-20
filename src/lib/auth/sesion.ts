import { getServerSession, type Session } from "next-auth";
import { authOptions, type Rol } from "./opciones";

export type SesionSemaforo = Session & {
  rol: Rol;
  demo: boolean;
  login: string;
};

export async function obtenerSesion(): Promise<SesionSemaforo | null> {
  return (await getServerSession(authOptions)) as SesionSemaforo | null;
}

/** Caso 1: solo el administrador crea o edita. La demo y los lectores solo leen. */
export function puedeEscribir(sesion: SesionSemaforo | null): boolean {
  return sesion?.rol === "admin" && !sesion.demo;
}
