import { isMonitorAuthorized } from "@/lib/monitor/auth";

// Etapa 1: solo comprueba que GitHub Actions llega con el secreto. Las revisiones llegan en el caso 3.
export async function POST(request: Request) {
  if (
    !isMonitorAuthorized(
      request.headers.get("authorization"),
      process.env.MONITOR_SECRET,
    )
  ) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  return Response.json({ checked: 0 });
}
