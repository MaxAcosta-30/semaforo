# API pública de estado y siembra de la demo (caso 9)

- `GET /api/status/[slug]`: mismo estado que `/status/[slug]` (nombre, estado, disponibilidad 24 h y 7 días, último check, incidentes de 7 días en fechas). Sin CI, repo, URLs ni errores crudos.
- Solo productos públicos; privado e inexistente dan 404 con el mismo cuerpo. Límite: 60 por minuto por IP (tabla `rate_limits`, clave `status:<ip>`) → 429 con `Retry-After`. `Cache-Control: public, max-age=60, s-maxage=60`, CORS `*` solo aquí.
- OpenAPI 3.1 a mano en `public/openapi.json` (servido estático); una prueba compara las claves de la respuesta real con el esquema.
- Demo: `pnpm db:demo` (Hito + 2 ejemplos, upsert por slug, validación Zod y SSRF). Corre con Node 24 y un hook de alias (`scripts/alias.mjs`), sin dependencias nuevas. Se niega a correr si `DATABASE_URL` no es local, salvo `DEMO_BASE_REMOTA=1`.
- Verificado: pruebas de integración contra PostgreSQL local (200, 404, 429, sin datos internos; dos siembras = 3 productos).
- NO VERIFICADO: sembrar en Supabase (lo hará Max o el deploy), que los 3 endpoints respondan 200 desde el monitor real, y el endpoint en producción.
