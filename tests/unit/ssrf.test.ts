import { describe, expect, it } from "vitest";
import { esIpPublica, type Resolver, validarUrl } from "@/lib/monitor/ssrf";

const dns =
  (tabla: Record<string, string[]>): Resolver =>
  async (host) => {
    const r = tabla[host];
    if (!r) throw new Error("ENOTFOUND");
    return r;
  };
const publico = dns({
  "ejemplo.com": ["93.184.215.14", "2606:2800:21f:cb07:6820:80da:af6b:8b2c"],
});

describe("esIpPublica", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.13",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:a9fe:a9fe",
    "64:ff9b::a00:1",
  ])("bloquea %s", (ip) => {
    expect(esIpPublica(ip)).toBe(false);
  });

  it.each(["93.184.215.14", "8.8.8.8", "172.32.0.1", "2606:4700:4700::1111"])(
    "permite %s",
    (ip) => {
      expect(esIpPublica(ip)).toBe(true);
    },
  );

  it("rechaza lo que no es IP", () => {
    expect(esIpPublica("ejemplo.com")).toBe(false);
  });
});

describe("validarUrl", () => {
  it("acepta https público y devuelve las IPs validadas", async () => {
    const r = await validarUrl("https://ejemplo.com/salud", publico);
    expect(r.ok && r.direcciones).toEqual([
      "93.184.215.14",
      "2606:2800:21f:cb07:6820:80da:af6b:8b2c",
    ]);
  });

  it.each([
    ["http://ejemplo.com/", "Solo se aceptan URLs https."],
    ["ftp://ejemplo.com/", "Solo se aceptan URLs https."],
    ["no es url", "No es una URL válida."],
    [
      "https://admin:clave@ejemplo.com/",
      "La URL no puede llevar usuario ni contraseña.",
    ],
    ["https://ejemplo.com:5432/", "Solo se acepta el puerto 443."],
    ["https://localhost/", "No se permiten direcciones locales."],
    ["https://api.localhost/", "No se permiten direcciones locales."],
    [
      "https://169.254.169.254/latest/meta-data/",
      "La URL apunta a una red privada o reservada.",
    ],
    ["https://0x7f.1/", "La URL apunta a una red privada o reservada."],
    ["https://2130706433/", "La URL apunta a una red privada o reservada."],
    ["https://[::1]/", "La URL apunta a una red privada o reservada."],
    [
      "https://[::ffff:127.0.0.1]/",
      "La URL apunta a una red privada o reservada.",
    ],
    [
      "https://no-existe.invalid/",
      "El dominio no existe o no se pudo resolver.",
    ],
  ])("rechaza %s", async (url, motivo) => {
    expect(await validarUrl(url, publico)).toEqual({ ok: false, motivo });
  });

  it("rechaza un dominio que resuelve a una IP interna (DNS apuntando a la red local)", async () => {
    const r = await validarUrl(
      "https://interno.ejemplo.com/",
      dns({ "interno.ejemplo.com": ["10.0.0.5"] }),
    );
    expect(r.ok).toBe(false);
  });

  it("rechaza si UNA de las direcciones es interna", async () => {
    const mixto = dns({ "mixto.ejemplo.com": ["93.184.215.14", "127.0.0.1"] });
    expect((await validarUrl("https://mixto.ejemplo.com/", mixto)).ok).toBe(
      false,
    );
  });

  it("rechaza un dominio sin direcciones", async () => {
    const vacio = dns({ "vacio.ejemplo.com": [] });
    expect(await validarUrl("https://vacio.ejemplo.com/", vacio)).toEqual({
      ok: false,
      motivo: "El dominio no tiene direcciones.",
    });
  });

  it("acepta el puerto 443 escrito de forma explícita", async () => {
    expect((await validarUrl("https://ejemplo.com:443/", publico)).ok).toBe(
      true,
    );
  });
});
