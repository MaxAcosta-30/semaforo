# 0004 · Cabeceras de seguridad y CSP sin nonce

**Contexto.** El CLAUDE.md pide CSP, `X-Content-Type-Options` y `Referrer-Policy` en `next.config`. La app usa `cacheComponents` (prerender parcial): el armazón de cada página se genera estático y Next inyecta scripts en línea para hidratar.

**Decisión.** Cabeceras globales en `next.config.ts`: CSP con `default-src 'self'`, `script-src 'self' 'unsafe-inline'` (más `'unsafe-eval'` solo en desarrollo), `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`, `connect-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self' https://github.com` (el login con GitHub) y `frame-ancestors 'none'`; además `nosniff`, `strict-origin-when-cross-origin`, `X-Frame-Options: DENY` y `Permissions-Policy` restrictiva. Sin `X-Powered-By`.

**Alternativas descartadas.** CSP con nonce por petición: obliga a renderizar cada página de forma dinámica y se pierde el prerender parcial. Hashes de scripts: Next no los expone de forma estable para el armazón prerenderizado.

**Consecuencias.** `'unsafe-inline'` en scripts debilita la defensa ante XSS; la mitigan que React escapa todo el contenido, que no hay `dangerouslySetInnerHTML` y que `connect-src`, `form-action` y `frame-ancestors` siguen cerrados. Los estilos en línea (`style={{…}}`) requieren `'unsafe-inline'` en estilos.

**Revisar si:** Next ofrece SRI/hashes estables para el prerender parcial, o se agrega contenido de terceros.
