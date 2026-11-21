# Caso 6: checklist por versión y aprobación

- **Datos:** `checklist_marks` (producto + versión + renglón, quién y cuándo) y `release_approvals` (única por producto + versión, con color y motivos en JSON). `products.version_candidata` dice qué versión se prepara (migración 0005).
- **Regla:** la checklist incompleta de la versión candidata da amarillo, leída de la base. El color de la aprobación se calcula en el servidor al aprobar; el cliente nunca lo manda.
- **Rutas (solo admin, 401/403 si no):** `POST /api/productos/[slug]/checklist`, `POST .../aprobar` (201; 409 en rojo o si la versión ya estaba aprobada), `PUT .../version`.
- **Panel:** la casilla cambia al instante (`useOptimistic`) y regresa si el servidor rechaza; el botón deshabilitado se ve hundido y dice por qué.
- **Pruebas:** `tests/integration/aprobaciones.test.ts` (marcar por versión, quién/cuándo/color, rojo 409, una vez por versión, lector/demo 403, sin sesión 401, admin 204). 140 de integración y 2 e2e en verde.
- **Verificado en local (build de producción, 390 px):** con sesión de admin firmada con el secreto de e2e, marcar 4 renglones → amarillo → aprobar → 201 y fila guardada con `amarillo` y su motivo; en Hito (rojo) el botón queda bloqueado.
- **NO VERIFICADO:** el flujo con una sesión real de GitHub (falta la OAuth App de Max).
