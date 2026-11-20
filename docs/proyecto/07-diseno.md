# Etapa 2 · Diseño

Prototipo navegable: `docs/diseno/prototipo.html` (ábrelo en el navegador). Capturas: `docs/diseno/claro-1440.png`, `oscuro-1440.png`, `celular-390.png`.

## Casos → pantallas

| Pantalla                     | Casos         | Para qué                                                                    |
| ---------------------------- | ------------- | --------------------------------------------------------------------------- |
| Tablero `/`                  | 3, 5, 7, 9    | Responder "¿se puede liberar?" para todos los productos de un vistazo       |
| Detalle `/productos/[slug]`  | 3, 4, 5, 6, 7 | Ver el motivo del color, GitHub, incidentes, checklist y aprobar            |
| Pública `/status/[slug]`     | 8             | Estado y disponibilidad para cualquiera, sin datos internos                 |
| Entrar `/entrar`             | 1, 9          | Iniciar sesión con GitHub o "Entrar como demo"                              |
| Registrar `/productos/nuevo` | 2             | Nombre, slug, repositorio y endpoints (con el error de SSRF junto al campo) |

## Brief (5 líneas)

- **Para quién:** un desarrollador minutos antes de publicar una versión.
- **Qué debe sentir en 3 s:** certeza (o alarma justificada).
- **Personalidad:** señalero.
- **Lo que debe recordar:** la vía que termina en una señal.
- **Contenido más fuerte:** el historial de checks de 24 h → se vuelve la firma.

## Tres direcciones (elegida: A)

|            | A · Enclavamiento                                          | B · Lista de despegue                             | C · Gabinete de control               |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------- | ------------------------------------- |
| Referencia | Cuadro de mando ferroviario                                | Checklist de aviación                             | Controlador de semáforos de calle     |
| Tipografía | Barlow Condensed + IBM Plex Sans/Mono                      | Archivo Narrow + JetBrains Mono                   | Space Grotesk + Space Mono            |
| Paleta     | Esmalte `#EFEDE4`, vía `#1C1F1E`, latón `#7D6228` + lentes | Papel `#F6F1E3`, tinta `#141414`, ámbar `#E8A317` | Esmalte gris `#3A403D`, cromo, lentes |
| Firma      | Vía de 24 bloques que termina en una señal de 3 lentes     | Renglones con puntos guía "CI ……… VERDE"          | Cabeza de semáforo 3D por producto    |

**Por qué A** (`software-maestro` §7.4, sin Max presente: la más audaz que sigue siendo legible): la firma _es_ el dato (el historial de checks) y no un adorno; B repite el mundo de papel de Hito; C es decoración literal y pesa más. Max puede cambiarla: los tokens viven en un solo lugar.

## Tokens (en `src/app/globals.css`)

- **Superficies:** `--esmalte` (fondo), `--placa` (tarjetas), `--hundido` (campos). Oscuro: `#111312 / #191C1A / #0C0E0D`.
- **Texto:** `--via` (principal), `--via-2` (secundario), `--tenue` (metadatos, peor contraste medido 4.92:1).
- **Acción y foco:** `--via` relleno para el botón primario; `--laton` para enlaces y anillo de foco (5.36:1).
- **Estado:** lentes `--lente-verde/ambar/rojo` (rellenos) y `--texto-verde/ambar/rojo` (texto, ≥ 6.2:1). La caja de la señal (`--caja`) es oscura en ambos temas y la lente apagada es casi negra: solo brilla la encendida.
- **Bordes:** `--riel` (rgba 14 %) y `--riel-fuerte` (28 %). Profundidad: solo bordes, sin sombras.
- **Tipografía:** Barlow Condensed 700 en mayúsculas solo para titulares y el nombre del producto en el detalle; IBM Plex Sans para lectura; IBM Plex Mono con cifras tabulares para disponibilidad, latencia, fechas y repos. Escala 1.25 sobre 15 px.
- **Espaciado:** base 4 px; filas del tablero 18/20 px; radios 4 px (controles) y 8 px (cuadros).

## Componentes

- **Vía (firma):** 24 bloques de 1 h. Sin fallos = vía (2 px, tinta); latencia alta = bloque ámbar de 10 px; con fallos = bloque rojo de 18 px; sin datos = vía punteada. **El estado se lee por altura además de por color**; cada bloque tiene `title` y la vía tiene `aria-label` con el resumen.
- **Señal:** 3 lentes en orden ferroviario (rojo arriba). Siempre acompañada de ícono + texto ("Verde · vía libre", "Amarillo · precaución", "Rojo · alto") y del motivo. La señal es `aria-hidden`: el texto lleva el significado.
- **Botones:** primario (relleno tinta), secundario (borde). 40 px de alto; `:active` a 0.97; deshabilitado al 50 %.
- **Avisos:** ámbar (monitor detenido, datos de GitHub viejos) y rojo (error al leer), con ícono y `role="status"`/`"alert"`.

## Estados obligatorios (en el prototipo)

Carga (esqueletos que respetan `prefers-reduced-motion`), vacío (con la acción "Registrar producto"), error (con "Reintentar"), monitor detenido > 45 min (caso 9: ningún producto puede quedar verde) y éxito (el tablero).

## Verificado

- axe: 0 violaciones en claro y oscuro, a 1440 y 390 px; sin desplazamiento horizontal.
- Contraste AA medido en todos los textos (peor 4.92:1).
- Autocrítica: se corrigió la caja de la señal que se volvía clara en oscuro, la lente apagada más brillante que la encendida y un panel estirado.

## Para la construcción (Etapa 3)

Fuentes con `next/font` (solo los pesos usados: Barlow Condensed 700, Plex Sans 400/500/600, Plex Mono 400/500). CSS Modules por componente; tokens en `globals.css`.
