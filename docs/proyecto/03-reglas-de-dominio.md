# Etapa 3 (adelanto) · Reglas de dominio puras

Hecho sin nube mientras la Etapa 1 espera las cuentas de Supabase y Vercel. No toca la base ni la interfaz.

- `src/lib/domain/semaforo.ts` (caso 5): rojo/amarillo/verde con todos los motivos, rojos primero. "Datos suficientes" = al menos 48 checks en 24 h (la mitad de 96) y CI conocido; sin datos nunca es verde. La disponibilidad se trunca al mostrarla (98.96 % no se lee "99.0 %").
- `src/lib/domain/metricas.ts` (caso 3): disponibilidad 24 h/7 d (null sin checks) y p95 por rango más cercano, solo de checks exitosos.
- `src/lib/domain/incidentes.ts` (caso 7): abre con 3 fallos seguidos, cierra con 2 éxitos seguidos.
- `src/lib/monitor/ssrf.ts` (casos 2 y 3): https, puerto 443, sin credenciales en la URL; todas las IPs resueltas deben ser públicas (`net.BlockList`), incluidas IPv4 dentro de IPv6 y formas como `0x7f.1`.
- Pendiente para el caso 3: conectar a la IP ya validada (evita _DNS rebinding_) y validar cada redirección con `validarUrl`.
- 74 pruebas unitarias nuevas; suite completa 79/79 con PostgreSQL local.
