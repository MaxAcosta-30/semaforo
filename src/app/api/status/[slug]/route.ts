import { getDb } from "@/lib/db/client";
import { estadoDeProducto } from "@/lib/estado/producto";
import { ipDe, permitir } from "@/lib/limites";

// Endpoint público de solo lectura (OpenAPI en public/openapi.json). Devuelve lo mismo que
// la página /status/[slug]: sin CI, checklist, repo, URLs de endpoints ni motivos crudos.
const LIMITE = 60;
const VENTANA_MS = 60_000;

const CORS = { "Access-Control-Allow-Origin": "*" };
const noEncontrado = () =>
  Response.json(
    { error: "No encontrado" },
    { status: 404, headers: { ...CORS, "Cache-Control": "no-store" } },
  );

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/status/[slug]">,
) {
  const db = getDb();
  if (
    !(await permitir(db, `status:${ipDe(request.headers)}`, LIMITE, VENTANA_MS))
  )
    return Response.json(
      { error: "Demasiadas peticiones" },
      {
        status: 429,
        headers: {
          ...CORS,
          "Retry-After": String(VENTANA_MS / 1000),
          "Cache-Control": "no-store",
        },
      },
    );

  const { slug } = await params;
  const estado = await estadoDeProducto(db, slug, { checklistCompleta: true });
  // Un producto privado es indistinguible de uno inexistente.
  if (!estado || !estado.producto.publico) return noEncontrado();

  return Response.json(
    {
      nombre: estado.producto.nombre,
      slug: estado.producto.slug,
      estado: estado.publico,
      disponibilidad24h: estado.disponibilidad24h,
      disponibilidad7d: estado.disponibilidad7d,
      ultimoCheck: estado.ultimoCheck?.toISOString() ?? null,
      incidentes: estado.incidentes.map((i) => ({
        abierto: i.abierto.toISOString(),
        cerrado: i.cerrado?.toISOString() ?? null,
      })),
    },
    {
      headers: {
        ...CORS,
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    },
  );
}
