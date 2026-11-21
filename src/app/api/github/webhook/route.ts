// Webhooks de GitHub: con firma HMAC válida, marca vencida la caché del repo para que la
// próxima lectura consulte a GitHub. No llama a GitHub aquí. El sondeo sigue de respaldo.
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { githubDeliveries, githubSnapshots, products } from "@/lib/db/schema";

export const MAX_BYTES = 1024 * 1024;

export function firmaValida(
  secreto: string,
  cuerpo: Uint8Array,
  encabezado: string | null,
): boolean {
  if (!encabezado?.startsWith("sha256=")) return false;
  const esperada = createHmac("sha256", secreto).update(cuerpo).digest();
  const recibida = Buffer.from(encabezado.slice(7), "hex");
  return (
    recibida.length === esperada.length && timingSafeEqual(recibida, esperada)
  );
}

const Evento = z.object({
  action: z.string().optional(),
  repository: z.object({ full_name: z.string() }).optional(),
  workflow_run: z.object({ head_branch: z.string().nullable() }).optional(),
});

export async function POST(request: Request) {
  const secreto = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secreto)
    return Response.json({ error: "Webhook no configurado" }, { status: 503 });

  const declarado = Number(request.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > MAX_BYTES)
    return new Response(null, { status: 413 });
  const cuerpo = new Uint8Array(await request.arrayBuffer());
  if (cuerpo.length > MAX_BYTES) return new Response(null, { status: 413 });

  if (!firmaValida(secreto, cuerpo, request.headers.get("x-hub-signature-256")))
    return new Response(null, { status: 401 });

  const evento = request.headers.get("x-github-event");
  const entrega = request.headers.get("x-github-delivery");
  if (evento === "ping") return Response.json({ ok: true });
  if (!entrega) return new Response(null, { status: 400 });

  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(cuerpo));
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = Evento.safeParse(json);
  if (!parsed.success) return new Response(null, { status: 400 });
  const { action, repository, workflow_run } = parsed.data;

  const relevante =
    (evento === "workflow_run" && workflow_run?.head_branch === "main") ||
    evento === "release" ||
    (evento === "pull_request" &&
      ["opened", "closed", "reopened"].includes(action ?? ""));
  if (!relevante || !repository)
    return Response.json({ ignored: true }, { status: 202 });

  // GitHub no distingue mayúsculas en dueño/repositorio; el producto pudo registrarse con otras.
  const repo = repository.full_name.toLowerCase();
  const db = getDb();
  const [producto] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(sql`lower(${products.repo})`, repo));
  if (!producto) return Response.json({ ignored: true }, { status: 202 });

  // En una transacción: si vencer la caché falla, la entrega no queda marcada y GitHub
  // puede reintentarla.
  const duplicada = await db.transaction(async (tx) => {
    const nueva = await tx
      .insert(githubDeliveries)
      .values({ deliveryId: entrega, event: evento })
      .onConflictDoNothing()
      .returning({ id: githubDeliveries.deliveryId });
    if (nueva.length === 0) return true;
    await tx
      .update(githubSnapshots)
      .set({ consultadoAt: new Date(0) })
      .where(eq(sql`lower(${githubSnapshots.repo})`, repo));
    return false;
  });
  return Response.json(duplicada ? { duplicate: true } : { ok: true });
}
