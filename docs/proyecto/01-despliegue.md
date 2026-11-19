# Etapa 1 · Despliegue temprano

- Límites verificados el 2026-11-19: Vercel Hobby, funciones de 300 s máx. y cron 1 vez al día (±59 min); Supabase Free, 2 proyectos activos, 500 MB y pausa tras 7 días con poca actividad.
- `/api/monitor/run`: `POST` con `Authorization: Bearer` y `timingSafeEqual` sobre hashes SHA-256; responde `{ checked: 0 }`.
- Página inicial muestra si la base responde (Suspense + `connection()`).
- RLS sin políticas en todas las tablas + prueba que lo exige (ADR 0002).
- `deploy.yml`: CI reutilizable → migraciones por session pooler → `vercel deploy --prebuilt --prod`. `vercel.json` apaga el auto-deploy de `main`.
- `monitor.yml`: `7,22,37,52 * * * *` + ejecución manual; falla si faltan `APP_URL` o `MONITOR_SECRET`.
- Pendiente para el caso 3: Vercel Cron llama con `GET` y `Authorization: Bearer $CRON_SECRET`, así que `/api/monitor/cleanup` debe aceptar `GET`, no `POST` como dice el plan.

## Reactivar el monitor

GitHub desactiva los workflows programados de un repo público tras 60 días sin commits. Para reactivarlo: **Actions → Monitor → Enable workflow**, o `gh workflow enable monitor.yml -R MaxAcosta-30/semaforo`. Luego córrelo a mano con `gh workflow run monitor.yml` para confirmar.
