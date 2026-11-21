// Debería: alertas de incidentes a un webhook de Discord (opcional).
// La URL del webhook es un secreto: nunca se imprime. Un fallo aquí jamás rompe al monitor.

interface Datos {
  producto: string;
  slug: string;
  endpoint: string; // URL completa; solo se muestra host + ruta
}

const HOSTS = new Set(["discord.com", "discordapp.com"]);

function webhookValido(valor: string): string | null {
  try {
    const u = new URL(valor);
    const bien =
      u.protocol === "https:" &&
      HOSTS.has(u.hostname) &&
      u.pathname.startsWith("/api/webhooks/");
    return bien ? u.toString() : null;
  } catch {
    return null;
  }
}

function hostYRuta(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return "endpoint desconocido";
  }
}

function enlace(slug: string): string {
  const base = process.env.APP_URL?.trim().replace(/\/+$/, "");
  return base ? `\n${base}/productos/${slug}` : "";
}

export function duracion(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 === 0 ? `${h} h` : `${h} h ${min % 60} min`;
}

async function enviar(contenido: string): Promise<void> {
  const crudo = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!crudo) return;
  const url = webhookValido(crudo);
  if (!url) {
    console.warn(
      "Alerta de Discord omitida: DISCORD_WEBHOOK_URL no es un webhook https de discord.com.",
    );
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: contenido }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`Alerta de Discord no enviada: respondió ${res.status}.`);
    }
  } catch (e) {
    const nombre = e instanceof Error ? e.name : "error";
    console.warn(`Alerta de Discord no enviada: ${nombre}.`);
  }
}

export function alertarApertura(d: Datos, causa: string): Promise<void> {
  const texto = causa.slice(0, 200);
  return enviar(
    `🔴 Incidente abierto en ${d.producto}\nEndpoint: ${hostYRuta(d.endpoint)}\nCausa: 3 fallos seguidos; el último: ${texto}${enlace(d.slug)}`,
  );
}

export function alertarCierre(d: Datos, duracionMs: number): Promise<void> {
  return enviar(
    `🟢 Incidente cerrado en ${d.producto}\nEndpoint: ${hostYRuta(d.endpoint)}\nDuración: ${duracion(duracionMs)}${enlace(d.slug)}`,
  );
}
