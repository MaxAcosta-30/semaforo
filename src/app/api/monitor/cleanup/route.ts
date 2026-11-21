import { lt } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { checks, githubDeliveries } from "@/lib/db/schema";
import { isMonitorAuthorized } from "@/lib/monitor/auth";

export const DIAS_DE_CHECKS = 30;
export const DIAS_DE_ENTREGAS = 7;

// Vercel Cron la llama una vez al día con GET y "Authorization: Bearer $CRON_SECRET".
// Borra checks de más de 30 días para no llenar los 500 MB de Supabase Free.
export async function GET(request: Request) {
  if (
    !isMonitorAuthorized(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const limite = new Date(Date.now() - DIAS_DE_CHECKS * 24 * 60 * 60 * 1000);
  const db = getDb();
  const borrados = await db
    .delete(checks)
    .where(lt(checks.checkedAt, limite))
    .returning({ id: checks.id });
  const limiteEntregas = new Date(
    Date.now() - DIAS_DE_ENTREGAS * 24 * 60 * 60 * 1000,
  );
  const entregas = await db
    .delete(githubDeliveries)
    .where(lt(githubDeliveries.receivedAt, limiteEntregas))
    .returning({ id: githubDeliveries.deliveryId });
  return Response.json({
    deleted: borrados.length,
    deliveriesDeleted: entregas.length,
  });
}
