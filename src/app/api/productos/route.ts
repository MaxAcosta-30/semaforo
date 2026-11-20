import { getDb } from "@/lib/db/client";
import { obtenerSesion, puedeEscribir } from "@/lib/auth/sesion";
import { registrarProducto } from "@/lib/productos/registro";

// Caso 2. Los permisos se validan aquí, en el servidor: ocultar el botón no protege nada.
export async function POST(request: Request) {
  const sesion = await obtenerSesion();
  if (!sesion)
    return Response.json({ error: "Inicia sesión" }, { status: 401 });
  if (!puedeEscribir(sesion))
    return Response.json(
      { error: "Solo el administrador puede registrar productos" },
      { status: 403 },
    );

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json(
      { errores: { cuerpo: "El cuerpo debe ser JSON." } },
      { status: 400 },
    );
  }
  const r = await registrarProducto(getDb(), cuerpo);
  if (!r.ok) return Response.json({ errores: r.errores }, { status: r.estado });
  return Response.json({ id: r.id, slug: r.slug }, { status: 201 });
}
