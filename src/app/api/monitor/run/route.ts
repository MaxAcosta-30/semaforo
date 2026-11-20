import { getDb } from "@/lib/db/client";
import { isMonitorAuthorized } from "@/lib/monitor/auth";
import { ejecutarMonitor } from "@/lib/monitor/ejecutar";

// Vercel Hobby permite hasta 300 s por función; cada petición tiene timeout de 10 s.
export const maxDuration = 300;

// GitHub Actions lo llama cada 15 minutos (monitor.yml) con MONITOR_SECRET.
export async function POST(request: Request) {
  if (
    !isMonitorAuthorized(
      request.headers.get("authorization"),
      process.env.MONITOR_SECRET,
    )
  ) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const r = await ejecutarMonitor(getDb());
  return Response.json({
    checked: r.revisados,
    failed: r.fallidos,
    incidentsOpened: r.incidentesAbiertos,
    incidentsClosed: r.incidentesCerrados,
  });
}
