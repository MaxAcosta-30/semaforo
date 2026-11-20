# 0003 · Auth.js con next-auth 4 (estable), no la v5 en beta

- **Fecha:** 2026-11-19
- **Estado:** aceptada

**Contexto.** `CLAUDE.md` pide Auth.js con GitHub. Al 19 de noviembre de 2026, `next-auth@latest` es 4.24.15 (compatible con Next 16) y la v5 sigue en `5.0.0-beta.32`.

**Decisión.** next-auth 4.24.15 con sesión JWT en cookie HttpOnly, proveedor de GitHub (solo si existen `GITHUB_ID` y `GITHUB_SECRET`) y un proveedor de credenciales `demo` que entra como lector (caso 9). Solo entran cuentas de GitHub de la tabla `members`.

**Por qué no la v5.** Una dependencia de autenticación en beta puede cambiar su API sin aviso; la v4 tiene años en producción.

**Revisar si.** La v5 sale estable: migrar es cambiar `getServerSession(authOptions)` por `auth()`.
