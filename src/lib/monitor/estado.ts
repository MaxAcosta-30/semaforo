import { desc } from "drizzle-orm";
import type { getDb } from "@/lib/db/client";
import { monitorRuns } from "@/lib/db/schema";
import { MINUTOS_MAXIMOS_SIN_CHECK } from "@/lib/domain/semaforo";

type Db = ReturnType<typeof getDb>;

/** Caso 9: minutos desde la última corrida del monitor y si ya se considera detenido. */
export async function estadoDelMonitor(db: Db, ahora = new Date()) {
  const [ultima] = await db
    .select()
    .from(monitorRuns)
    .orderBy(desc(monitorRuns.finishedAt))
    .limit(1);
  const minutos = ultima
    ? Math.floor((ahora.getTime() - ultima.finishedAt.getTime()) / 60_000)
    : null;
  return {
    minutos,
    atrasado: minutos === null || minutos > MINUTOS_MAXIMOS_SIN_CHECK,
  };
}
