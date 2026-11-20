import { aprobar, productoPorSlug } from "@/lib/aprobaciones";
import { exigirAdmin } from "@/lib/auth/exigir";
import { getDb } from "@/lib/db/client";
import { ciDesdeGitHub } from "@/lib/estado/fuentes";
import { estadoDeProducto } from "@/lib/estado/producto";

// Caso 6: el color se calcula aquí, en el servidor, en el momento de aprobar; nunca lo manda el cliente.
export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/productos/[slug]/aprobar">,
) {
  const permiso = await exigirAdmin();
  if ("respuesta" in permiso) return permiso.respuesta;
  const db = getDb();
  const { slug } = await params;
  const p = await productoPorSlug(db, slug);
  const estado = p
    ? await estadoDeProducto(db, slug, { ci: ciDesdeGitHub })
    : null;
  if (!p || !estado)
    return Response.json({ error: "No existe" }, { status: 404 });

  const r = await aprobar(
    db,
    p.id,
    p.versionCandidata,
    estado.semaforo,
    permiso.sesion.login,
  );
  return r.ok
    ? Response.json(r.aprobacion, { status: 201 })
    : Response.json({ error: r.error }, { status: r.estado });
}
