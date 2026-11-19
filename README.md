# Semáforo

Saber si se puede liberar, antes de liberar.

Herramienta que vigila productos web y dice si una versión está lista para publicarse. En construcción; el README completo llega al final del proyecto.

## Correr en local

Requiere Node 24, pnpm (vía Corepack) y Docker.

```sh
corepack enable pnpm
pnpm install
cp .env.example .env
docker compose up -d --wait
pnpm db:migrate
pnpm dev
```

`pnpm test` corre las pruebas contra el PostgreSQL de `compose.yaml`.
