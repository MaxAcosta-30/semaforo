# Etapa 3 (adelanto) · Estado del repositorio en GitHub (caso 4)

- `estadoRepositorio(db, "dueño/repo")`: CI de `main` (solo `event=push`, para que las corridas programadas del monitor no cuenten), último release y PRs abiertos.
- Caché en `github_snapshots` con el ETag de cada recurso: datos frescos 5 min sin red; luego petición condicional. Verificado en la documentación de GitHub (19 nov 2026): un `304` no gasta límite **solo si va autenticado**, por eso el token es importante.
- Límite en `github_rate_limit`: con 5 peticiones o menos y antes de `x-ratelimit-reset`, se sirve la caché y se avisa. Si GitHub falla, también.
- El nombre del repositorio se valida antes de armar la URL (sin `..`, sin rutas extra).
- Pruebas: 13 con MSW 3 contra PostgreSQL local; suite 107/107 estable en orden aleatorio.
- Pendiente: mostrarlo en la interfaz (Etapa 2 · diseño) y en el semáforo. **Max:** crear un token _fine-grained_ de solo lectura (Contents, Actions y Pull requests: read) y guardarlo como `GITHUB_TOKEN` en Vercel.
