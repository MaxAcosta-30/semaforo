# Semáforo

Herramienta interna que vigila productos web y dice si una versión está lista para publicarse: verde se puede publicar, amarillo hay que revisar y rojo no se publica.

**Frase del proyecto:** "Saber si se puede liberar, antes de liberar."

## Propósito

Proyecto de portafolio de Max Acosta para aplicar a puestos de desarrollo web con TypeScript, React, Next.js y Node.js. Debe demostrar que sabe integrar APIs REST, trabajar con SQL, probar su código, cuidar la seguridad y vigilar productos en producción. Presupuesto: $0 al mes. Tiempo: entre 130 y 175 horas.

## Cómo debes trabajar

1. Trabaja una etapa a la vez. Al terminar cada una, muestra el resultado y **espera la aprobación de Max**.
2. Explica cada decisión importante en una línea: por qué se toma y por qué no otra opción.
3. Antes de programar cada caso, explica el enfoque. Al terminarlo, hazle a Max 3 preguntas de entrevista sobre lo construido y corrige sus respuestas.
4. Usa una rama por caso, commits pequeños, un PR por caso y `main` siempre funcional.
5. Registra las decisiones grandes en `docs/decisiones/` como ADR cortos y el avance por etapa en `docs/proyecto/`.
6. Nunca guardes secretos en el repositorio. No inventes resultados: si algo no se probó, dilo.
7. Antes de crear recursos en la nube, verifica precios y límites vigentes. Si un servicio pide tarjeta o puede generar un cobro, detente y pregunta.
8. Si el proyecto va atrasado, recorta primero los casos "Debería" y avísale a Max.

### Ahorro de tokens

- Responde breve: resultado, decisión y siguiente paso. No resumas lo que hiciste ni repitas lo que dijo Max.
- Busca con grep o glob antes de abrir archivos, y lee solo las partes relevantes.
- No explores todo el repositorio ni releas archivos que no han cambiado.
- Muestra solo los cambios. En salidas largas, muestra solo los errores relevantes.
- Carga una skill solo en la etapa que la necesita. No uses subagentes salvo que Max lo pida.
- Si algo falla dos veces, detente, explica la causa probable y pregunta.
- Un caso por sesión. Al terminar, actualiza `docs/proyecto/` en máximo 10 líneas y sugiere abrir una sesión nueva.
- Excepción: nunca recortes la justificación de decisiones ni las preguntas de entrevista.

### Contra la sobreingeniería

- Antes de agregar una dependencia, capa, servicio o patrón, responde en una línea qué caso "Debe" o qué riesgo real resuelve. Si no hay respuesta, no se agrega.
- Usa primero lo que ya trae Next.js, Node o la plataforma.
- No crees interfaces, genéricos ni abstracciones hasta repetir el mismo patrón 3 veces.
- No agregues configuración ni opciones para casos futuros.
- Objetivos de aprendizaje de este proyecto, que sí se justifican: CSS escrito a mano, integración con la API de GitHub, pruebas y CI/CD.

## Alcance

### Actores

- **Administrador:** registra productos, edita la checklist y aprueba publicaciones.
- **Lector:** consulta el estado, pero no modifica nada.
- **Visitante:** ve la página de estado pública sin iniciar sesión.
- **Monitor:** proceso automático que ejecuta las revisiones.

### Debe

| # | Caso | Criterio de aceptación |
|---|---|---|
| 1 | Iniciar sesión con GitHub | Solo entran usuarios de la tabla `members`; un lector no puede crear ni editar, y una prueba lo comprueba |
| 2 | Registrar productos | Nombre, slug, repositorio y endpoints con estado esperado y latencia máxima; validación con Zod; URLs protegidas contra SSRF |
| 3 | Revisar endpoints cada 15 minutos | Guarda estado, latencia y error; calcula disponibilidad de 24 horas y de 7 días; cada petición tiene timeout de 10 segundos |
| 4 | Consultar el estado del repositorio | Muestra el CI de `main`, el último release y los PRs abiertos con la API de GitHub; usa caché y respeta el límite de peticiones |
| 5 | Calcular el semáforo | Cada color muestra su motivo; sin datos suficientes nunca es verde; las reglas tienen pruebas unitarias |
| 6 | Aprobar una publicación | La checklist manual se marca por versión; aprobar guarda quién, cuándo y el color en ese momento; con rojo no se puede aprobar |
| 7 | Manejar incidentes | Se abre tras 3 fallos seguidos, se cierra tras 2 éxitos seguidos y muestra su línea de tiempo |
| 8 | Ver la página de estado pública | `/status/[slug]` muestra estado, disponibilidad e incidentes recientes solo de productos marcados como públicos |
| 9 | Probar la demo | El botón "Entrar como demo" da acceso de lector; la demo vigila Hito y 2 productos de ejemplo; avisa si el monitor no ha corrido en 45 minutos |

### Debería

- Recibir webhooks de GitHub con verificación de firma HMAC en lugar de consultar la API.
- Enviar alertas de incidentes a un webhook de Discord.
- Documentar con OpenAPI el endpoint público de estado.

### Fuera de alcance

- Revisiones con menos de 15 minutos de intervalo.
- Monitoreo desde varias regiones.
- Equipos u organizaciones con varios espacios de trabajo.
- Despliegues automáticos desde Semáforo.
- App móvil.

### Reglas del semáforo

Las reglas son una función pura en `src/lib/domain/semaforo.ts`.

- **Rojo:**
  - El CI de `main` falla.
  - Hay un incidente abierto.
  - La disponibilidad de 24 horas es menor al 99 %.
- **Amarillo:**
  - La checklist está incompleta.
  - La latencia p95 supera el máximo.
  - El último check tiene más de 45 minutos.
  - No hay datos suficientes.
- **Verde:** no aplica ninguna regla anterior.

Si aplican varias reglas, gana la más grave y se muestran todos los motivos.

## Arquitectura

```text
Navegador
  └─ Next.js en Vercel (páginas + rutas de API en Node) ──> PostgreSQL en Supabase
                       │                                └─> API REST de GitHub
GitHub Actions ── cada 15 min ──> POST /api/monitor/run ──> endpoints vigilados
Vercel Cron ── una vez al día ──> POST /api/monitor/cleanup
```

### Decisiones

- **Next.js App Router con TypeScript estricto** | Por qué: lo pide la vacante, y las rutas de API cubren el backend en Node con un solo despliegue | Por qué no Express aparte: sería otro servicio sin un caso que lo necesite. Usa la versión estable más reciente.
- **CSS Modules y variables CSS** | Por qué: la vacante pide CSS sólido y esto lo demuestra | Por qué no Tailwind: ocultaría ese conocimiento.
- **PostgreSQL en Supabase con Drizzle** | Por qué: SQL explícito, ligero en serverless y con migraciones versionadas | Por qué no Prisma: es más pesado en serverless y esconde el SQL. Por qué no MongoDB: los datos son relacionales.
- **Supabase solo como base de datos** | Por qué: el backend debe vivir en Node para demostrarlo | Por qué no Supabase Auth ni su API automática: Max no practicaría lo que pide la vacante.
- **Auth.js con GitHub** | Por qué: una herramienta interna para desarrolladores usa la cuenta de GitHub, y Max practica OAuth | Por qué no JWT propio: ya lo hizo en Hito.
- **Zod** | Por qué: valida entradas en servidor y formularios con el mismo esquema | Por qué no validación manual: se repetiría en cada ruta.
- **Sin Redis, colas ni servicio de monitoreo aparte** | Por qué: con un intervalo de 15 minutos alcanza con PostgreSQL y una ruta de API.

### Modelo de datos inicial

`members`, `products`, `endpoints`, `checks`, `incidents`, `github_snapshots`, `checklist_items`, `release_approvals`, `monitor_runs`.

- `checks` lleva índice por `endpoint_id` y fecha.
- `monitor_runs` registra cada corrida y sirve para avisar si el monitor dejó de correr.
- La limpieza diaria borra `checks` de más de 30 días para no llenar los 500 MB de Supabase.

### Estructura

```text
semaforo/
├── src/
│   ├── app/               páginas y rutas de API
│   ├── components/
│   └── lib/
│       ├── domain/        reglas puras: semáforo, disponibilidad, incidentes
│       ├── db/            esquema y cliente de Drizzle
│       ├── github/        cliente de la API de GitHub
│       └── monitor/       ejecución de revisiones y validación de URLs
├── drizzle/               migraciones
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── decisiones/
│   ├── proyecto/
│   └── depuracion.md
├── .github/workflows/     ci.yml, monitor.yml, deploy.yml
├── compose.yaml
└── README.md
```

### Seguridad mínima

- **SSRF:** el servidor pide URLs que registra un usuario, así que solo acepta `https`, resuelve el DNS y bloquea `localhost`, IPs privadas, de enlace local y de metadatos. Tampoco sigue redirecciones hacia esas direcciones. Prueba cada caso.
- **Permisos:** se validan en el servidor, en cada ruta. El rol demo es de solo lectura.
- **Monitor:** `/api/monitor/*` exige `Authorization: Bearer` con `MONITOR_SECRET`, y lo compara con `crypto.timingSafeEqual`.
- **GitHub:** usa un token de solo lectura. Lee los encabezados de límite de peticiones y usa ETag para peticiones condicionales; verifica en la documentación cómo afectan al límite.
- **Límites de intentos:** en el login, en "Entrar como demo" y en las rutas públicas.
- **Cabeceras:** CSP, `X-Content-Type-Options` y `Referrer-Policy` en `next.config`.
- **Secretos:** en variables de entorno de Vercel y en los secretos de GitHub Actions.

## Infraestructura a $0

Datos revisados el 10 de noviembre de 2026. Verifícalos otra vez antes de crear recursos.

**Regla de costo:** usa solo planes gratuitos y no registres ninguna tarjeta.

- **App: Vercel Hobby.** Es de uso personal y no comercial, así que sirve para portafolio. Sus cron jobs solo corren una vez al día y con hasta 59 minutos de retraso, por eso solo se usan para la limpieza. Revisa el tiempo máximo de ejecución de funciones en Hobby y ajusta el monitor a ese límite.
- **Base de datos: Supabase Free, segundo proyecto.** El plan permite 2 proyectos activos y Hito usa uno; si ya no hay espacio, detente y pregunta.
  - **Desde Vercel:** conéctate con el transaction pooler (puerto 6543) y desactiva los prepared statements (`prepare: false`).
  - **Migraciones desde GitHub Actions:** usa el session pooler (puerto 5432).
- **Monitor: GitHub Actions programado.** Usa `cron: '7,22,37,52 * * * *'` para evitar el inicio de cada hora.
  - **Retrasos:** GitHub puede retrasar o saltarse corridas con mucha carga. La interfaz muestra "último check hace X minutos".
  - **Inactividad:** en un repositorio público, las tareas programadas se desactivan tras 60 días sin actividad. Documenta cómo reactivarlas.
- **Hito en Render:** revisarlo cada 15 minutos lo mantiene casi siempre despierto, cerca de 730 de 750 horas al mes. Antes de agregarlo, pregúntale a Max si tiene otros servicios en Render.

### Despliegue

- **Previews:** Vercel crea una vista previa por cada PR.
- **Producción:** desactiva el despliegue automático de `main` en Vercel. `deploy.yml` hace: pruebas → migraciones → `vercel deploy --prod`.
- **Migraciones:** compatibles hacia atrás; nunca borres una columna en el mismo despliegue que deja de usarla.

## Pruebas

- **Unitarias (Vitest):** reglas del semáforo, disponibilidad, p95, apertura y cierre de incidentes, y validación contra SSRF.
- **Integración:** rutas de API contra PostgreSQL real (servicio `postgres` en GitHub Actions), con la API de GitHub y los endpoints simulados con MSW. Incluye la prueba de que un lector no puede escribir.
- **E2E (Playwright):** un flujo: entrar como demo → abrir un producto → ver el semáforo y su motivo.
- **Depuración:** `docs/depuracion.md` explica cómo reproducir un check fallido en local, leer los logs de Vercel y usar el inspector de Node.

## Etapas

Detente y espera aprobación al final de cada una.

### Etapa 0: preparación

1. Verifica Node LTS, pnpm, Docker, Git y GitHub CLI. Dile a Max qué falta.
2. Crea el proyecto Next.js con TypeScript estricto, ESLint y Prettier.
3. Crea `compose.yaml` con PostgreSQL, Drizzle y la primera migración.
4. Crea `/api/health` y `ci.yml` con lint, revisión de tipos, pruebas y build.

### Etapa 1: despliegue temprano

1. Guía a Max para crear el proyecto de Supabase y conectar Vercel. No debe registrar tarjeta ni pegarte contraseñas.
2. Publica una página mínima conectada a la base y deja `deploy.yml` funcionando.
3. Crea `monitor.yml` llamando a `/api/monitor/run` con una respuesta vacía, y confirma que corre.

### Etapa 2: diseño

1. Mapea los casos Debe a pantallas.
2. Usa `interface-design` si está disponible para definir la dirección visual. Presenta 2 o 3 opciones.
3. Los colores del semáforo deben cumplir contraste y nunca depender solo del color: cada estado lleva icono y texto.
4. Guarda las reglas en `docs/proyecto/07-diseno.md` y diseña el tablero, el detalle del producto y la página pública, con estados de carga, vacío, error y éxito.

### Etapa 3: casos 1 a 4

Construye un caso completo a la vez, de la interfaz a la base de datos.

### Etapa 4: casos 5 a 9

Termina el semáforo, las aprobaciones, los incidentes, la página pública y la demo.

### Etapa 5: calidad

1. Completa las pruebas.
2. Revisa accesibilidad, rendimiento y seguridad. Usa `vercel-web-quality` y `code-review` si están disponibles.

### Etapa 6: presentación

1. Escribe el README: problema, demo, capturas, arquitectura, decisiones, cómo correrlo y límites conocidos.
2. Escribe 3 viñetas para el CV que digan solo lo que el repositorio demuestra.
3. Haz con Max una entrevista simulada de 10 preguntas sobre el proyecto.

## Definición de terminado

- [ ] Los 9 casos Debe cumplen su criterio.
- [ ] La demo pública funciona desde una ventana privada.
- [ ] El monitor lleva al menos 7 días corriendo con datos reales.
- [ ] El CI pasa y el despliegue a producción es automático.
- [ ] El costo mensual es $0 y ningún servicio tiene tarjeta registrada.
- [ ] El README permite entender el proyecto en menos de 2 minutos.
- [ ] Max puede explicar cada decisión sin ayuda, incluida la protección contra SSRF.
