# Casos 1, 2 y 9 + tablero y detalle

- **Caso 1:** next-auth 4 (ADR 0003). Solo entran miembros de `members`; el rol viaja en el JWT. `puedeEscribir`: solo admin y nunca la demo. Los permisos se validan en el servidor.
- **Caso 9:** "Entrar como demo" da lector; límite de 10 entradas por minuto por IP guardado en PostgreSQL (`rate_limits`, atómico en una sentencia). La placa avisa si el monitor no ha corrido en 45 min.
- **Caso 2 (API):** `POST /api/productos` con Zod y validación SSRF por URL; 401 sin sesión, 403 lector/demo, 409 slug repetido. Falta el formulario.
- **Pantallas:** `/entrar`, tablero `/` y detalle `/productos/[slug]` con el diseño "Enclavamiento" y datos reales (GitHub incluido).
- **E2E (Playwright, en el CI):** entrar como demo → tablero → producto en rojo con su motivo; y la página pública oculta los privados.
- **Verificado en local (build de producción):** axe 0 en `/`, `/productos/hito` y `/entrar`, claro y oscuro, 1440 y 390 px. El limitador de la demo se comprobó sin querer: tras más de 10 entradas en un minuto rechazó la siguiente.
- **Falta (Max):** OAuth App de GitHub (`GITHUB_ID`, `GITHUB_SECRET`), `NEXTAUTH_SECRET` y `NEXTAUTH_URL` en Vercel, y registrar tu cuenta en `members` como admin.
