# Etapa 0 · Preparación

- Herramientas: Node 24.21 (fnm), pnpm 12.21 (Corepack), Docker 29.9, Compose 5.7, Git 2.56, gh 2.97.
- Next.js 16.4.6 con App Router, `src/`, TypeScript estricto + `noUncheckedIndexedAccess`, ESLint 9 y Prettier.
- PostgreSQL 17 en `compose.yaml`; Drizzle + postgres.js con `prepare: false`; migración `0000` crea `members` (ADR 0001).
- `/api/health`: 200 si la base responde y 503 si no; probado en vivo y con Vitest contra PostgreSQL real.
- `ci.yml`: formato, lint, tipos, migraciones, pruebas y build con servicio `postgres`.
- Commits con el correo noreply de GitHub para no publicar el correo personal.
- `software-maestro*.md` excluido por `.gitignore`.
- Pendiente: Etapa 1 (Supabase, Vercel, `deploy.yml`, `monitor.yml`).
