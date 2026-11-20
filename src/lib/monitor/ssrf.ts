// Protección contra SSRF (casos 2 y 3). El servidor pide URLs que registra un usuario:
// sin esto, alguien podría registrar http://169.254.169.254/ (metadatos de la nube) o
// http://localhost:5432 y usar a Semáforo para explorar la red interna.
//
// Reglas: solo https al puerto 443, sin usuario ni contraseña en la URL, y TODAS las
// direcciones a las que resuelve el nombre deben ser públicas. El monitor debe conectarse
// a la IP que se validó (no volver a resolver) y validar cada redirección con esta función.

import { BlockList, isIP } from "node:net";

export type Resolver = (host: string) => Promise<string[]>;

export type ResultadoUrl =
  { ok: true; url: URL; direcciones: string[] } | { ok: false; motivo: string };

const bloqueadas = new BlockList();
// IPv4 que no son internet pública (RFC 6890 y relacionados)
for (const [red, prefijo] of [
  ["0.0.0.0", 8], // "esta red"
  ["10.0.0.0", 8], // privada
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // enlace local y metadatos de la nube (169.254.169.254)
  ["172.16.0.0", 12], // privada
  ["192.0.0.0", 24], // asignaciones de protocolo
  ["192.0.2.0", 24], // documentación
  ["192.88.99.0", 24], // relay 6to4
  ["192.168.0.0", 16], // privada
  ["198.18.0.0", 15], // pruebas de rendimiento
  ["198.51.100.0", 24], // documentación
  ["203.0.113.0", 24], // documentación
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reservada y broadcast
] as const) {
  bloqueadas.addSubnet(red, prefijo, "ipv4");
}
for (const [red, prefijo] of [
  ["::", 128], // no especificada
  ["::1", 128], // loopback
  ["64:ff9b:1::", 48], // NAT64 local
  ["100::", 64], // descarte
  ["2001:db8::", 32], // documentación
  ["fc00::", 7], // única local (privada)
  ["fe80::", 10], // enlace local
  ["ff00::", 8], // multicast
] as const) {
  bloqueadas.addSubnet(red, prefijo, "ipv6");
}

/** IPv4 escondida dentro de una IPv6 (::ffff:127.0.0.1 o 64:ff9b::7f00:1). */
function ipv4Incrustada(ip: string): string | null {
  const minus = ip.toLowerCase();
  const mapeada = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(minus);
  if (mapeada?.[1]) return mapeada[1];
  const hex = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(
    minus,
  );
  if (hex?.[1] && hex[2]) {
    const alto = parseInt(hex[1], 16);
    const bajo = parseInt(hex[2], 16);
    return [alto >> 8, alto & 255, bajo >> 8, bajo & 255].join(".");
  }
  return null;
}

export function esIpPublica(ip: string): boolean {
  const version = isIP(ip);
  if (version === 0) return false;
  if (version === 4) return !bloqueadas.check(ip, "ipv4");
  const v4 = ipv4Incrustada(ip);
  if (v4 !== null) return esIpPublica(v4);
  return !bloqueadas.check(ip, "ipv6");
}

export async function validarUrl(
  entrada: string,
  resolver: Resolver,
): Promise<ResultadoUrl> {
  let url: URL;
  try {
    url = new URL(entrada);
  } catch {
    return { ok: false, motivo: "No es una URL válida." };
  }
  if (url.protocol !== "https:")
    return { ok: false, motivo: "Solo se aceptan URLs https." };
  if (url.username || url.password) {
    return {
      ok: false,
      motivo: "La URL no puede llevar usuario ni contraseña.",
    };
  }
  if (url.port !== "" && url.port !== "443") {
    return { ok: false, motivo: "Solo se acepta el puerto 443." };
  }

  // URL.hostname conserva los corchetes de IPv6 ("[::1]"); se quitan para validar la IP
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1");
  if (host === "localhost" || host.endsWith(".localhost")) {
    return { ok: false, motivo: "No se permiten direcciones locales." };
  }

  let direcciones: string[];
  if (isIP(host) !== 0) {
    direcciones = [host];
  } else {
    try {
      direcciones = await resolver(host);
    } catch {
      return {
        ok: false,
        motivo: "El dominio no existe o no se pudo resolver.",
      };
    }
  }
  if (direcciones.length === 0) {
    return { ok: false, motivo: "El dominio no tiene direcciones." };
  }
  // Si UNA sola dirección es interna se rechaza: el atacante podría alternar entre ellas.
  if (!direcciones.every(esIpPublica)) {
    return {
      ok: false,
      motivo: "La URL apunta a una red privada o reservada.",
    };
  }
  return { ok: true, url, direcciones };
}
