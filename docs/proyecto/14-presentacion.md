# Etapa 6 · Presentación (borrador)

- `README.md` completo: problema, demo pendiente, capturas, casos, arquitectura (Mermaid), decisiones, seguridad, pruebas, local y límites.
- Capturas reales en `docs/capturas/` (12 PNG: tablero, detalle rojo y página pública; 1440 y 390 px; claro y oscuro), generadas con `scripts/capturas.mjs`.
- `docs/proyecto/cv.md`: 3 viñetas con cifras reales (181 pruebas, 9 + 3 casos).
- Pruebas el 20 nov: 178 Vitest (21 archivos) y 3 e2e, todas verdes.
- Hallazgo: `next.config.ts` no define CSP ni cabeceras de seguridad, y `docs/depuracion.md` (citado en CLAUDE.md) no existe; el README lo declara.
- Pendiente de Max: Supabase, secretos, OAuth App, despliegue y entrevista simulada de 10 preguntas.
