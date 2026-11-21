# Debería · alertas de incidentes a Discord

- **Qué hace:** al abrirse y al cerrarse un incidente, `ejecutarMonitor` envía un mensaje (`src/lib/alertas/discord.ts`) a un webhook de Discord. Una alerta por apertura y una por cierre; se envía después de guardar el incidente.
- **Configuración:** `DISCORD_WEBHOOK_URL` (opcional; sin ella no pasa nada). Solo se acepta `https://discord.com` o `discordapp.com` con ruta `/api/webhooks/`; si no, se ignora con un aviso sin imprimir la URL (es un secreto). `APP_URL` (opcional) agrega el enlace a `/productos/<slug>`.
- **Contenido:** producto, host + ruta del endpoint (sin query), causa y, al cerrar, duración.
- **Fallos:** timeout de 5 s; red, timeout o 4xx/5xx solo generan `console.warn` y nunca rompen la corrida.
- **Probado (MSW + PostgreSQL):** `tests/integration/alertas-discord.test.ts`: abrir (1 POST), sin repetir mientras sigue abierto, cierre, sin variable, Discord 500, error de red, timeout y URLs no válidas.
- **NO VERIFICADO:** el envío real a un Discord (no se envió nada fuera de las pruebas). **Max:** crear el webhook y guardarlo como `DISCORD_WEBHOOK_URL` en Vercel y en el monitor.
