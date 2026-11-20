import { eq } from "drizzle-orm";
import { z } from "zod";
import { exigirAdmin } from "@/lib/auth/exigir";
import { getDb } from "@/lib/db/client";
import { products } from "@/lib/db/schema";

const cuerpo = z.object({
  version: z
    .string()
    .trim()
    .regex(
      /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
      "Usa una versión como v2.3.0.",
    ),
});

// Caso 6: fija la versión que se está preparando (la checklist es por versión).
export async function PUT(
  request: Request,
  { params }: RouteContext<"/api/productos/[slug]/version">,
) {
  const permiso = await exigirAdmin();
  if ("respuesta" in permiso) return permiso.respuesta;
  const datos = cuerpo.safeParse(await request.json().catch(() => null));
  if (!datos.success)
    return Response.json(
      { error: datos.error.issues[0]?.message ?? "Cuerpo inválido" },
      { status: 400 },
    );
  const filas = await getDb()
    .update(products)
    .set({ versionCandidata: datos.data.version })
    .where(eq(products.slug, (await params).slug))
    .returning({ id: products.id });
  return filas.length
    ? new Response(null, { status: 204 })
    : Response.json({ error: "No existe" }, { status: 404 });
}
