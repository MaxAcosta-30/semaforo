# Caso 5 con datos reales y caso 8 · página pública

- `estadoDeProducto(db, slug)` junta checks (24 h y 7 días), incidentes y el CI de GitHub, y aplica `calcularSemaforo`. Con varios endpoints, el p95 que cuenta es el que más se pasa de **su** máximo. Sin CI conocido nunca es verde; si GitHub falla, el CI cuenta como desconocido y la página no se rompe.
- La vía de 24 bloques sale de los checks reales: la peor situación de cada hora (falla > lento > ok > sin datos).
- `/status/[slug]` (caso 8): solo productos públicos; sin CI, checklist ni URLs de endpoints. Estado público: normal, fallas intermitentes (< 99 %), incidente en curso o sin datos. Fechas en la zona de Culiacán.
- Componentes del diseño en React: `Senal`, `Tramo` e íconos propios; fuentes con `next/font` (servidas desde el mismo dominio).
- **Verificado en el servidor de producción local** con datos sembrados: captura a 390 px y axe 0 en claro y oscuro a 1440 y 390 px (con el contenido ya cargado y también en el estado de carga).
- **Límite conocido:** un producto privado o inexistente muestra la página de "no encontrado" con `noindex`, pero el código HTTP es 200, porque el contenido llega por streaming después de enviar el encabezado (comportamiento de Next con Suspense). No se filtra ningún dato.
- Pruebas: 8 nuevas del servicio; suite 115/115.
