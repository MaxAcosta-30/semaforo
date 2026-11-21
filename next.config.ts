import type { NextConfig } from "next";

// Cabeceras de seguridad (CLAUDE.md, "Seguridad mínima"). ADR 0004 explica la CSP:
// con cacheComponents el armazón de cada página es estático, así que no lleva nonce;
// por eso script-src admite 'unsafe-inline' (los scripts en línea los pone Next).
// En desarrollo, React necesita 'unsafe-eval' para recargar en caliente.
const desarrollo = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${desarrollo ? " 'unsafe-eval'" : ""}`,
  // style={{…}} en algunos componentes: atributos de estilo en línea.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${desarrollo ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  // El login con GitHub envía un formulario que redirige a github.com.
  "form-action 'self' https://github.com",
  "frame-ancestors 'none'",
].join("; ");

const cabeceras = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: cabeceras }];
  },
};

export default nextConfig;
