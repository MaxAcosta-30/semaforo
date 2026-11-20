import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:https";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { peticionHttps } from "@/lib/monitor/peticion";

// Servidor HTTPS local con un certificado autofirmado para "monitor.test", un nombre
// que no existe en el DNS: si la petición llega, es porque usó la IP fijada.
let servidor: Server;
let puerto: number;
let ca: Buffer;

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "semaforo-tls-"));
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "ec",
      "-pkeyopt",
      "ec_paramgen_curve:prime256v1",
      "-nodes",
      "-keyout",
      join(dir, "k.pem"),
      "-out",
      join(dir, "c.pem"),
      "-days",
      "1",
      "-subj",
      "/CN=monitor.test",
      "-addext",
      "subjectAltName=DNS:monitor.test",
    ],
    { stdio: "ignore" },
  );
  ca = readFileSync(join(dir, "c.pem"));
  servidor = createServer(
    { key: readFileSync(join(dir, "k.pem")), cert: ca },
    (req, res) => {
      if (req.url === "/redirige") {
        res.writeHead(301, { location: "https://169.254.169.254/" }).end();
      } else if (req.url === "/lento") {
        // nunca responde
      } else {
        res.writeHead(200).end("ok");
      }
    },
  );
  await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", r));
  puerto = (servidor.address() as AddressInfo).port;
});

afterAll(() => {
  servidor.closeAllConnections();
  servidor.close();
});

const url = (ruta: string, host = "monitor.test") =>
  new URL(`https://${host}:${puerto}${ruta}`);

describe("peticionHttps", () => {
  it("se conecta a la IP validada sin volver a resolver el nombre", async () => {
    const r = await peticionHttps(url("/salud"), ["127.0.0.1"], {
      tls: { ca },
    });
    expect(r.error).toBeNull();
    expect(r.status).toBe(200);
    expect(r.latenciaMs).toBeGreaterThanOrEqual(0);
  });

  it("no sigue redirecciones (aunque apunten a los metadatos de la nube)", async () => {
    const r = await peticionHttps(url("/redirige"), ["127.0.0.1"], {
      tls: { ca },
    });
    expect(r.status).toBe(301);
  });

  it("corta la petición al llegar al timeout", async () => {
    const r = await peticionHttps(url("/lento"), ["127.0.0.1"], {
      tls: { ca },
      timeoutMs: 300,
    });
    expect(r).toEqual({
      status: null,
      latenciaMs: null,
      error: "Sin respuesta en 0.3 s",
    });
  });

  it("verifica el certificado contra el nombre, no contra la IP", async () => {
    const r = await peticionHttps(url("/salud", "otro.test"), ["127.0.0.1"], {
      tls: { ca },
    });
    expect(r.error).toBe("Certificado TLS inválido");
  });

  it("rechaza un certificado que no es de una autoridad de confianza", async () => {
    const r = await peticionHttps(url("/salud"), ["127.0.0.1"]);
    expect(r.error).toBe("Certificado TLS inválido");
  });

  it("informa una conexión rechazada", async () => {
    const r = await peticionHttps(
      new URL("https://monitor.test:1/"),
      ["127.0.0.1"],
      { tls: { ca } },
    );
    expect(r.error).toBe("Conexión rechazada");
  });
});
