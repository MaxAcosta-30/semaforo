# 0001 · El esquema crece con cada caso

- **Fecha:** 2026-11-19
- **Estado:** aceptada

**Contexto.** `CLAUDE.md` lista 9 tablas iniciales, pero ninguna tiene todavía un caso construido que valide sus columnas.

**Decisión.** La primera migración crea solo `members` (caso 1). Cada caso agrega sus tablas en su propia migración.

**Por qué.** Cada columna nace con la prueba que la usa, y las migraciones quedan pequeñas y revisables en su PR.

**Por qué no las 9 tablas de una vez.** Habría que adivinar columnas y luego corregirlas con migraciones extra.

**Revisar si.** Un caso necesita datos de una tabla que otro caso todavía no creó.
