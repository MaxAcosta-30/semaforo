# Depuración

Cómo encontrar la causa cuando un check falla o algo se rompe en producción.

## 1. Reproducir un check fallido en local

```sh
docker compose up -d --wait
pnpm db:migrate
pnpm db:demo                    # Hito y 2 ejemplos, idempotente
export MONITOR_SECRET=$(openssl rand -hex 32)
pnpm build && MONITOR_SECRET=$MONITOR_SECRET pnpm start -p 3000
curl -s -X POST -H "Authorization: Bearer $MONITOR_SECRET" http://localhost:3000/api/monitor/run
```

La respuesta resume la corrida (checks hechos, incidentes abiertos y cerrados). Para ver qué guardó:

```sh
docker compose exec postgres psql -U semaforo -d semaforo \
  -c "select checked_at, ok, status, latency_ms, error from checks order by checked_at desc limit 20;"
```

Errores típicos: `La URL apunta a una red privada o reservada` (la validación SSRF la rechazó, revisa el DNS), `timeout` (más de 10 s), estado distinto al esperado.

## 2. Logs de producción (Vercel)

- Panel de Vercel → proyecto → **Logs**, filtrando por `/api/monitor/run` o por nivel `warning`/`error`.
- Los avisos de alertas a Discord y de webhooks nunca imprimen URLs ni secretos: solo el código de estado o el tipo de error.
- Si el tablero dice "El monitor no ha corrido en 45 min": revisa en GitHub → **Actions → monitor** que el workflow siga activo (GitHub lo desactiva tras 60 días sin actividad en repos públicos; se reactiva con "Enable workflow").

## 3. Inspector de Node

```sh
NODE_OPTIONS=--inspect pnpm dev
```

Abre `chrome://inspect` en Chrome, conecta al proceso y pon un punto de interrupción en `src/lib/monitor/ejecutar.ts` o en la ruta que falle. Para las pruebas: `pnpm vitest --inspect-brk --no-file-parallelism tests/integration/<archivo>.test.ts`.

## 4. Pruebas que ayudan a aislar

- `tests/integration/monitor-run.test.ts`: corrida completa con endpoints simulados (MSW).
- `tests/integration/peticion.test.ts`: la petición HTTPS con IP fijada y sus errores.
- `tests/unit/`: reglas del semáforo, disponibilidad, p95 e incidentes, sin base de datos.
