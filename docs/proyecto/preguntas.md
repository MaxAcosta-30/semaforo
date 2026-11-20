# Preguntas de entrevista

## Reglas de dominio (casos 3, 5 y 7)

1. ¿Por qué el semáforo es una función pura y qué ganas al probarlo así? ¿Qué pasa si aplican una regla roja y dos amarillas?
2. ¿Qué significa "datos suficientes" y por qué sin datos nunca puede ser verde?
3. Un usuario registra `https://interno.miempresa.com` y su DNS apunta a `10.0.0.5`. Recorre paso a paso qué hace `validarUrl`. ¿Qué es _DNS rebinding_ y por qué el monitor debe conectarse a la IP ya validada?

## Monitor (caso 3)

1. ¿Por qué el monitor vuelve a validar la URL en cada corrida si ya se validó al registrarla?
2. ¿Cómo se evita el _DNS rebinding_ en `peticionHttps` y por qué se verifica el certificado contra el nombre y no contra la IP?
3. Dos corridas del monitor se cruzan y las dos quieren abrir un incidente para el mismo endpoint. ¿Qué lo impide?

## GitHub (caso 4)

1. ¿Cómo funciona una petición condicional con ETag y en qué caso un `304` no gasta límite?
2. ¿Por qué el CI se filtra por `event=push`?
3. GitHub dice que quedan 3 peticiones. ¿Qué hace Semáforo y qué ve el usuario?

## Sesión (casos 1 y 9)

1. Un lector manda un `POST /api/productos` con curl. ¿Qué lo detiene y dónde?
2. ¿Por qué el límite de la demo vive en PostgreSQL y no en una variable en memoria?
3. ¿Qué pasa si alguien con cuenta de GitHub que no está en `members` intenta entrar?
