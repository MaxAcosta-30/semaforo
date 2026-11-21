import { obtenerSesion, puedeEscribir, type SesionSemaforo } from "./sesion";

/** Para rutas que escriben: 401 sin sesión, 403 si no es admin (lector o demo). */
export async function exigirAdmin(): Promise<
  { sesion: SesionSemaforo } | { respuesta: Response }
> {
  const sesion = await obtenerSesion();
  if (!sesion)
    return {
      respuesta: Response.json({ error: "Inicia sesión" }, { status: 401 }),
    };
  if (!puedeEscribir(sesion))
    return {
      respuesta: Response.json(
        { error: "Solo el administrador puede hacer esto" },
        { status: 403 },
      ),
    };
  return { sesion };
}
