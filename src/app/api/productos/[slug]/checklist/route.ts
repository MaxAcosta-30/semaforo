import { z } from "zod";
import { marcar, productoPorSlug } from "@/lib/aprobaciones";
import { exigirAdmin } from "@/lib/auth/exigir";
import { getDb } from "@/lib/db/client";

const cuerpo = z.object({
  item: z.string().min(1).max(100),
  marcado: z.boolean(),
});

// Caso 6: marca o desmarca un renglón de la checklist de la versión candidata.
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/productos/[slug]/checklist">,
) {
  const permiso = await exigirAdmin();
  if ("respuesta" in permiso) return permiso.respuesta;
  const datos = cuerpo.safeParse(await request.json().catch(() => null));
  if (!datos.success)
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 });

  const db = getDb();
  const p = await productoPorSlug(db, (await params).slug);
  if (!p) return Response.json({ error: "No existe" }, { status: 404 });
  const r = await marcar(
    db,
    p.id,
    p.versionCandidata,
    datos.data.item,
    datos.data.marcado,
    permiso.sesion.login,
  );
  return r.ok
    ? new Response(null, { status: 204 })
    : Response.json({ error: r.error }, { status: 400 });
}
