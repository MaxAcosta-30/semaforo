# Etapa 3 (adelanto) · Monitor del caso 3

- Tablas nuevas (migración `0002`): `products` y `endpoints` (modelo del caso 2; su registro llega con el caso 2 completo), `checks`, `incidents` y `monitor_runs`, todas con RLS. Índice único parcial: un solo incidente abierto por endpoint.
- `ejecutarMonitor`: valida cada URL en **cada** corrida (el DNS puede cambiar), hace la petición, guarda el check, aplica la máquina de incidentes y registra la corrida. 5 peticiones a la vez.
- `peticionHttps` (`node:https`): conecta a la IP ya validada (sin segunda resolución de DNS), verifica el certificado por nombre, no sigue redirecciones, timeout de 10 s y cuerpo con tope de 256 KB.
- `POST /api/monitor/run` ya ejecuta el monitor (`maxDuration` 300 s). `GET /api/monitor/cleanup` borra checks de más de 30 días; Vercel Cron la llama a diario (`vercel.json`) con `CRON_SECRET`.
- Pruebas: 92/92 con PostgreSQL local, estables en orden aleatorio. La petición HTTPS se prueba contra un servidor local con certificado autofirmado para `monitor.test` (nombre que no existe en el DNS).
- Pendiente (Max): variable `CRON_SECRET` en Vercel.
