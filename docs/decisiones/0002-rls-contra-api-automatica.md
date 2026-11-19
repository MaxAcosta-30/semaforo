# 0002 · RLS sin políticas en todas las tablas

- **Fecha:** 2026-11-19
- **Estado:** aceptada

**Contexto.** Semáforo usa Supabase solo como PostgreSQL. Aun así, Supabase publica el esquema `public` en su API automática y la clave `anon` es pública por diseño: una tabla sin RLS se puede leer y modificar desde internet.

**Decisión.** Toda tabla se declara con `.enableRLS()` en Drizzle y no lleva políticas. Los roles `anon` y `authenticated` no ven nada; el servidor entra como dueño de las tablas y no le afecta. Además se apaga la Data API en el panel de Supabase.

**Por qué.** Queda en una migración versionada y una prueba (`tests/integration/rls.test.ts`) falla si una tabla nueva olvida RLS. Apagar la Data API es la segunda capa.

**Por qué no solo apagar la Data API.** Es un interruptor del panel: no se versiona ni se prueba, y alguien puede volver a encenderlo.

**Revisar si.** Algún día el navegador necesita leer de Supabase directamente (hoy no: todo pasa por las rutas de Node).
