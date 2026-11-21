# Webhooks de GitHub (Debería)

- `POST /api/github/webhook`: lee el cuerpo crudo (máx. 1 MB, si no 413) y verifica `X-Hub-Signature-256` (HMAC-SHA256 con `GITHUB_WEBHOOK_SECRET`, `timingSafeEqual`). Sin secreto: 503; firma ausente o inválida: 401. No registra secreto, firma ni cuerpo.
- Idempotencia: `X-GitHub-Delivery` en `github_deliveries` (migración `0006`); repetida responde 200 sin reprocesar. `/api/monitor/cleanup` borra entregas de más de 7 días.
- Eventos: `ping` 200; `workflow_run` solo de `main`, `release` y `pull_request` (opened/closed/reopened) ponen `consultado_at` en 1970 en `github_snapshots` del repo, solo si pertenece a un producto; la siguiente lectura consulta GitHub. Otros: 202. JSON inválido: 400.
- No llama a la API de GitHub; el sondeo con caché y ETag sigue como respaldo.
- Pruebas: `tests/integration/webhook-github.test.ts` con PostgreSQL local y el vector de ejemplo de la documentación de GitHub.
- NO VERIFICADO: la configuración real en GitHub (URL, secreto, eventos) y la entrega desde GitHub. **Max:** `openssl rand -hex 32`, guardarlo como `GITHUB_WEBHOOK_SECRET` y pegarlo en Settings → Webhooks (application/json; workflow runs, releases, pull requests).
