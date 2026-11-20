// Caso 3: una petición HTTPS a un endpoint vigilado.
//
// - Se conecta a la IP que validarUrl ya aprobó (lookup fijo): si el DNS cambia entre la
//   validación y la conexión (DNS rebinding), no importa, porque no se vuelve a resolver.
// - El certificado se verifica contra el nombre del dominio (servername), no contra la IP.
// - No sigue redirecciones: un 301 se registra como su código y no lleva a ningún lado.
// - Timeout total de 10 s y lectura del cuerpo con tope, para que nadie cuelgue al monitor.

import { request, type RequestOptions } from "node:https";
import { isIP } from "node:net";

export const TIMEOUT_MS = 10_000;
const MAX_BYTES_CUERPO = 256 * 1024;

export interface ResultadoPeticion {
  status: number | null;
  latenciaMs: number | null;
  error: string | null;
}

export type Peticion = (
  url: URL,
  direcciones: string[],
  opciones?: { timeoutMs?: number; tls?: Pick<RequestOptions, "ca"> },
) => Promise<ResultadoPeticion>;

export const peticionHttps: Peticion = (url, direcciones, opciones = {}) => {
  const timeoutMs = opciones.timeoutMs ?? TIMEOUT_MS;
  const ip = direcciones[0];
  if (!ip)
    return Promise.resolve({
      status: null,
      latenciaMs: null,
      error: "Sin dirección validada",
    });
  const familia = isIP(ip) === 6 ? 6 : 4;
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1");

  return new Promise((resolve) => {
    const inicio = performance.now();
    let terminado = false;
    const terminar = (r: ResultadoPeticion) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(reloj);
      resolve(r);
    };

    const req = request(
      {
        protocol: "https:",
        hostname: host,
        port: url.port === "" ? 443 : Number(url.port), // validarUrl ya exige 443 en producción
        path: `${url.pathname}${url.search}`,
        method: "GET",
        servername: isIP(host) === 0 ? host : undefined,
        headers: { "user-agent": "Semaforo-Monitor/1.0", accept: "*/*" },
        // Fija la conexión a la IP validada: no hay segunda resolución de DNS.
        lookup: (_h, opts, cb) => {
          if (opts && typeof opts === "object" && "all" in opts && opts.all) {
            cb(null, [{ address: ip, family: familia }]);
          } else {
            (cb as (e: Error | null, a: string, f: number) => void)(
              null,
              ip,
              familia,
            );
          }
        },
        ...opciones.tls,
      },
      (res) => {
        let leidos = 0;
        res.on("data", (trozo: Buffer) => {
          leidos += trozo.length;
          if (leidos > MAX_BYTES_CUERPO) res.destroy(); // basta con saber que respondió
        });
        const fin = () =>
          terminar({
            status: res.statusCode ?? null,
            latenciaMs: Math.round(performance.now() - inicio),
            error: null,
          });
        res.on("end", fin);
        res.on("close", fin);
      },
    );

    const reloj = setTimeout(() => {
      req.destroy();
      terminar({
        status: null,
        latenciaMs: null,
        error: `Sin respuesta en ${timeoutMs / 1000} s`,
      });
    }, timeoutMs);

    req.on("error", (e: NodeJS.ErrnoException) =>
      terminar({ status: null, latenciaMs: null, error: describirError(e) }),
    );
    req.end();
  });
};

function describirError(e: NodeJS.ErrnoException): string {
  if (e.code === "ECONNREFUSED") return "Conexión rechazada";
  if (e.code === "ECONNRESET") return "La conexión se cortó";
  if (e.code === "ENETUNREACH" || e.code === "EHOSTUNREACH")
    return "Red inalcanzable";
  if (e.code?.startsWith("ERR_TLS") || e.code?.includes("CERT"))
    return "Certificado TLS inválido";
  return "Error de red";
}
