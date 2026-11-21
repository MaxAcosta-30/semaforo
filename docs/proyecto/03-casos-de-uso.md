# Casos de uso

Estado según `docs/proyecto/0*-*.md`, el código y `gh pr list --state all` (20 nov 2026). Todos los PR siguen en borrador salvo el #1; "cumplido (con PR)" significa construido y probado en su PR, aún sin fusionar a `main`.

## Caso 1 · Iniciar sesión con GitHub (Debe)

- **Actor:** Administrador y Lector · **Permiso:** entrar solo si está en `members`; solo el administrador escribe.
- **Para qué:** identificar quién usa la herramienta y limitar quién puede modificar.
- **Condición previa:** la cuenta de GitHub está registrada en `members` con rol; OAuth App configurada (`GITHUB_ID`, `GITHUB_SECRET`, `NEXTAUTH_SECRET`).
- **Flujo:** 1. El usuario abre `/entrar` y elige GitHub. 2. Auth.js valida la cuenta contra `members`. 3. El rol viaja en el JWT. 4. Cada ruta de API valida el permiso en el servidor.
- **Errores y casos límite:** una cuenta que no está en `members` es rechazada; otro proveedor se rechaza; la demo nunca escribe.
- **Criterio de aceptación:** Solo entran usuarios de la tabla `members`; un lector no puede crear ni editar, y una prueba lo comprueba.
- **Pruebas:** `tests/unit/auth.test.ts` (miembro, no miembro, otro proveedor, rol en el token, `puedeEscribir`); `tests/integration/productos-api.test.ts` (lector y demo reciben 403, sin sesión 401); `tests/integration/aprobaciones.test.ts` (lector/demo 403).
- **Estado:** cumplido (con PR #8) en código y pruebas; **NO VERIFICADO** el flujo con una sesión real de GitHub: depende de la OAuth App y de las cuentas de Max.

## Caso 2 · Registrar productos (Debe)

- **Actor:** Administrador · **Permiso:** escribir (solo admin).
- **Para qué:** dar de alta lo que se vigila: nombre, slug, repositorio y endpoints.
- **Condición previa:** sesión de administrador.
- **Flujo:** 1. Abre `/productos/nuevo`. 2. Llena nombre, slug, repo y de 1 a 5 endpoints (estado esperado y latencia máxima). 3. El servidor valida con Zod y revisa cada URL contra SSRF. 4. Guarda producto y endpoints en una transacción y redirige al detalle.
- **Errores y casos límite:** errores por campo (400); URL interna o privada rechazada junto al campo; slug repetido 409; slug `nuevo` reservado; 401 sin sesión y 403 lector/demo.
- **Criterio de aceptación:** Nombre, slug, repositorio y endpoints con estado esperado y latencia máxima; validación con Zod; URLs protegidas contra SSRF.
- **Pruebas:** `tests/integration/productos-api.test.ts`; `tests/unit/ssrf.test.ts`; `tests/unit/slug.test.ts`; `tests/e2e/demo.spec.ts` (la demo no ve el formulario).
- **Estado:** cumplido (con PR #8 la API y #10 el formulario); **NO VERIFICADO** con una sesión real de GitHub (falta la OAuth App de Max).

## Caso 3 · Revisar endpoints cada 15 minutos (Debe)

- **Actor:** Monitor · **Permiso:** `Authorization: Bearer` con `MONITOR_SECRET`.
- **Para qué:** tener datos reales de disponibilidad y latencia.
- **Condición previa:** endpoints registrados; GitHub Actions llama a `POST /api/monitor/run` (`monitor.yml`).
- **Flujo:** 1. La ruta valida el secreto. 2. Por cada endpoint se revalida la URL (SSRF) y se hace la petición (5 a la vez). 3. Se guarda estado, latencia y error en `checks`. 4. Se actualizan los incidentes y se registra la corrida en `monitor_runs`. 5. La disponibilidad de 24 h y 7 días se calcula en `src/lib/domain/metricas.ts`.
- **Errores y casos límite:** timeout de 10 s; certificado inválido; redirecciones no seguidas; URL que ahora resuelve a red interna se bloquea sin petición; 401 sin secreto; GitHub puede retrasar corridas.
- **Criterio de aceptación:** Guarda estado, latencia y error; calcula disponibilidad de 24 horas y de 7 días; cada petición tiene timeout de 10 segundos.
- **Pruebas:** `tests/integration/monitor.test.ts`; `tests/integration/monitor-run.test.ts`; `tests/integration/peticion.test.ts`; `tests/integration/cleanup.test.ts`; `tests/unit/metricas.test.ts`; `tests/unit/monitor-auth.test.ts`.
- **Estado:** cumplido (con PR #4). El monitor real en producción y los 7 días de datos: NO VERIFICADO.

## Caso 4 · Consultar el estado del repositorio (Debe)

- **Actor:** Administrador y Lector · **Permiso:** lectura.
- **Para qué:** ver el CI de `main`, el último release y los PRs abiertos sin salir de la herramienta.
- **Condición previa:** `GITHUB_TOKEN` de solo lectura (opcional en local).
- **Flujo:** 1. La página del producto pide el estado. 2. `estadoRepositorio` usa la caché de 5 min o una petición condicional con ETag. 3. Con pocas peticiones restantes sirve la caché.
- **Errores y casos límite:** si GitHub falla se sirve la caché y el CI cuenta como desconocido; nombre de repo inválido rechazado antes de armar la URL.
- **Criterio de aceptación:** Muestra el CI de `main`, el último release y los PRs abiertos con la API de GitHub; usa caché y respeta el límite de peticiones.
- **Pruebas:** `tests/integration/github.test.ts` (13 con MSW).
- **Estado:** cumplido (con PR #5). El `GITHUB_TOKEN` real en Vercel: pendiente de Max, NO VERIFICADO.

## Caso 5 · Calcular el semáforo (Debe)

- **Actor:** Administrador, Lector y Visitante (ven el resultado) · **Permiso:** lectura.
- **Para qué:** decir si una versión puede publicarse.
- **Condición previa:** ninguna; sin datos suficientes el resultado es amarillo.
- **Flujo:** 1. `estadoDeProducto` junta checks, incidentes, CI y checklist. 2. `calcularSemaforo` (función pura) aplica las reglas. 3. Se muestran todos los motivos; gana el color más grave.
- **Errores y casos límite:** sin CI conocido nunca es verde; límites exactos no disparan la regla; si GitHub falla la página no se rompe.
- **Criterio de aceptación:** Cada color muestra su motivo; sin datos suficientes nunca es verde; las reglas tienen pruebas unitarias.
- **Pruebas:** `tests/unit/semaforo.test.ts`; `tests/integration/estado-producto.test.ts`; `tests/e2e/demo.spec.ts`.
- **Estado:** cumplido (con PR #3 las reglas y #7 con datos reales).

## Caso 6 · Aprobar una publicación (Debe)

- **Actor:** Administrador · **Permiso:** escribir (solo admin).
- **Para qué:** dejar constancia de quién aprobó qué versión y con qué color.
- **Condición previa:** sesión de administrador y una versión candidata.
- **Flujo:** 1. Marca los renglones de la checklist de la versión. 2. Pulsa aprobar. 3. El servidor calcula el color y, si no es rojo, guarda quién, cuándo, color y motivos.
- **Errores y casos límite:** rojo da 409; versión ya aprobada 409; renglón que no es de la checklist se rechaza; lector/demo 403 y sin sesión 401.
- **Criterio de aceptación:** La checklist manual se marca por versión; aprobar guarda quién, cuándo y el color en ese momento; con rojo no se puede aprobar.
- **Pruebas:** `tests/integration/aprobaciones.test.ts`.
- **Estado:** cumplido (con PR #9); **NO VERIFICADO** con una sesión real de GitHub (OAuth App de Max).

## Caso 7 · Manejar incidentes (Debe)

- **Actor:** Monitor (abre y cierra); Administrador, Lector y Visitante lo consultan · **Permiso:** lectura.
- **Para qué:** convertir fallos repetidos en un evento con historia.
- **Condición previa:** el monitor corre sobre endpoints registrados.
- **Flujo:** 1. Tras 3 fallos seguidos se abre el incidente (uno por endpoint). 2. Mientras siga abierto no se duplica. 3. Tras 2 éxitos seguidos se cierra. 4. El detalle del producto lista los incidentes de 7 días.
- **Errores y casos límite:** un éxito entre fallos reinicia la cuenta; un fallo suelto no reabre uno cerrado; índice único parcial evita duplicados entre corridas concurrentes.
- **Criterio de aceptación:** Se abre tras 3 fallos seguidos, se cierra tras 2 éxitos seguidos y muestra su línea de tiempo.
- **Pruebas:** `tests/unit/incidentes.test.ts`; `tests/integration/monitor.test.ts` (abrir, no duplicar, cerrar); `tests/integration/estado-producto.test.ts` (incidente abierto). La línea de tiempo de la interfaz: sin prueba automatizada propia.
- **Estado:** cumplido (con PR #4 la lógica y #8 el detalle); la línea de tiempo en pantalla solo se verificó a mano según `08-sesion-tablero-detalle.md` (axe), el contenido NO VERIFICADO con incidentes reales.

## Caso 8 · Ver la página de estado pública (Debe)

- **Actor:** Visitante · **Permiso:** lectura sin sesión.
- **Para qué:** que cualquiera consulte el estado de un producto público.
- **Condición previa:** el producto está marcado como público.
- **Flujo:** 1. Abre `/status/[slug]`. 2. Ve estado (normal, fallas intermitentes, incidente en curso o sin datos), disponibilidad e incidentes recientes. 3. No ve CI, checklist ni URLs de endpoints.
- **Errores y casos límite:** un producto privado o inexistente muestra "no encontrado" con `noindex` (límite conocido: HTTP 200 por el streaming de Next).
- **Criterio de aceptación:** `/status/[slug]` muestra estado, disponibilidad e incidentes recientes solo de productos marcados como públicos.
- **Pruebas:** `tests/integration/estado-producto.test.ts` (servicio); `tests/e2e/demo.spec.ts` (la página pública oculta los privados).
- **Estado:** cumplido (con PR #7).

## Caso 9 · Probar la demo (Debe)

- **Actor:** Visitante · **Permiso:** rol lector de solo lectura.
- **Para qué:** que quien evalúa el portafolio recorra la herramienta sin cuenta.
- **Condición previa:** datos de la demo cargados (Hito y 2 productos de ejemplo).
- **Flujo:** 1. Pulsa "Entrar como demo". 2. Ve el tablero y abre un producto. 3. Una placa avisa si el monitor no ha corrido en 45 minutos.
- **Errores y casos límite:** límite de 10 entradas por minuto por IP (PostgreSQL); la demo no puede escribir (403).
- **Criterio de aceptación:** El botón "Entrar como demo" da acceso de lector; la demo vigila Hito y 2 productos de ejemplo; avisa si el monitor no ha corrido en 45 minutos.
- **Pruebas:** `tests/e2e/demo.spec.ts`; `tests/unit/auth.test.ts` (la demo entra como lector); `tests/integration/productos-api.test.ts` (límite de intentos). El aviso de 45 minutos: sin prueba automatizada.
- **Estado:** en construcción (PR #8): el acceso de lector y el límite están hechos; la siembra de Hito y 2 productos de ejemplo (`pnpm db:demo`, ver `12-api-publica-y-demo.md`) es idempotente y probada en la base local; sembrarla en producción: NO VERIFICADO.

## Debería

- **Alertas de incidentes a Discord:** en construcción en la rama `etapa-4/alertas-discord` (ver `11-alertas-discord.md`); el envío real: NO VERIFICADO.
- **Webhooks de GitHub con firma HMAC:** pendiente.
- **OpenAPI del endpoint público de estado:** hecho en la rama `etapa-5/openapi-y-demo` (`public/openapi.json`, `GET /api/status/[slug]`, ver `12-api-publica-y-demo.md`); probado en local, en producción: NO VERIFICADO.
