# Viñetas para el CV

- Construí Semáforo, una herramienta en Next.js, TypeScript y PostgreSQL (Drizzle) que combina checks de disponibilidad, CI de GitHub, incidentes y una checklist para decir si una versión se puede publicar; implementé los 9 casos obligatorios y 3 opcionales (alertas a Discord, webhooks de GitHub y OpenAPI).
- Escribí 181 pruebas (86 unitarias y 92 de integración con Vitest contra PostgreSQL real y MSW, más 3 e2e con Playwright) y un CI en GitHub Actions que corre formato, lint, tipos, migraciones, pruebas, build y e2e.
- Protegí un monitor que hace peticiones a URLs registradas por usuarios: bloqueo de SSRF (IPs privadas, DNS rebinding, redirecciones), permisos validados en servidor, firma HMAC en webhooks, comparación de secretos con `timingSafeEqual`, límites de intentos y RLS en todas las tablas.
