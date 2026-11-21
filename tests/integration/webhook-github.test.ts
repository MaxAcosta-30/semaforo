import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/github/webhook/route";
import { GET as limpiar } from "@/app/api/monitor/cleanup/route";
import { getDb } from "@/lib/db/client";
import { githubDeliveries, githubSnapshots, products } from "@/lib/db/schema";
import { firmaValida } from "@/app/api/github/webhook/route";

const db = getDb();
const SECRETO = "secreto-del-webhook-de-prueba";
const REPO = "MaxAcosta-30/hito";
const FRESCO = new Date("2026-11-19T12:00:00Z");

const firmar = (cuerpo: string, secreto = SECRETO) =>
  "sha256=" + createHmac("sha256", secreto).update(cuerpo).digest("hex");

let n = 0;
function enviar(
  evento: string,
  payload: unknown,
  opciones: {
    firma?: string | null;
    entrega?: string;
    crudo?: string;
    headers?: Record<string, string>;
  } = {},
) {
  const cuerpo = opciones.crudo ?? JSON.stringify(payload);
  const headers: Record<string, string> = {
    "x-github-event": evento,
    "x-github-delivery": opciones.entrega ?? `entrega-${++n}`,
    ...opciones.headers,
  };
  const firma = opciones.firma === undefined ? firmar(cuerpo) : opciones.firma;
  if (firma) headers["x-hub-signature-256"] = firma;
  return POST(
    new Request("http://localhost/api/github/webhook", {
      method: "POST",
      body: cuerpo,
      headers,
    }),
  );
}

const consultado = async () =>
  (await db.select().from(githubSnapshots))[0]!.consultadoAt;

describe("POST /api/github/webhook", () => {
  beforeEach(async () => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", SECRETO);
    await db
      .insert(products)
      .values({ name: "Hito", slug: "hito-wh", repo: REPO });
    await db
      .insert(githubSnapshots)
      .values({ repo: REPO, recurso: "ci", consultadoAt: FRESCO });
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await db.delete(products);
    await db.delete(githubSnapshots);
    await db.delete(githubDeliveries);
  });

  const runMain = {
    repository: { full_name: REPO },
    workflow_run: { head_branch: "main" },
  };

  it("valida la firma con el vector de la documentación de GitHub", () => {
    const firma =
      "sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17";
    const cuerpo = new TextEncoder().encode("Hello, World!");
    expect(firmaValida("It's a Secret to Everybody", cuerpo, firma)).toBe(true);
    expect(firmaValida("otro", cuerpo, firma)).toBe(false);
    expect(firmaValida("It's a Secret to Everybody", cuerpo, "sha256=ab")).toBe(
      false,
    );
  });

  it("firma válida: 200 y la caché queda vencida", async () => {
    const res = await enviar("workflow_run", runMain);
    expect(res.status).toBe(200);
    expect((await consultado()).getTime()).toBe(0);
  });

  it("el repo se reconoce aunque GitHub lo mande con otras mayúsculas", async () => {
    const res = await enviar("workflow_run", {
      ...runMain,
      repository: { full_name: "maxacosta-30/HITO" },
    });
    expect(res.status).toBe(200);
    expect((await consultado()).getTime()).toBe(0);
  });

  it("firma inválida: 401 y nada cambia", async () => {
    const res = await enviar("workflow_run", runMain, {
      firma: firmar("x", "otro-secreto"),
    });
    expect(res.status).toBe(401);
    expect(await consultado()).toEqual(FRESCO);
    expect(await db.select().from(githubDeliveries)).toHaveLength(0);
  });

  it("sin firma: 401", async () => {
    expect(
      (await enviar("workflow_run", runMain, { firma: null })).status,
    ).toBe(401);
    expect(await consultado()).toEqual(FRESCO);
  });

  it("sin secreto configurado: 503", async () => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", "");
    const res = await enviar("workflow_run", runMain);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Webhook no configurado" });
  });

  it("la misma entrega dos veces se procesa una vez", async () => {
    const entrega = "11111111-1111-1111-1111-111111111111";
    expect((await enviar("release", runMain, { entrega })).status).toBe(200);
    await db.update(githubSnapshots).set({ consultadoAt: FRESCO });
    const segunda = await enviar("release", runMain, { entrega });
    expect(segunda.status).toBe(200);
    expect(await consultado()).toEqual(FRESCO);
    expect(await db.select().from(githubDeliveries)).toHaveLength(1);
  });

  it("workflow_run de otra rama no vence la caché", async () => {
    const res = await enviar("workflow_run", {
      repository: { full_name: REPO },
      workflow_run: { head_branch: "feature" },
    });
    expect(res.status).toBe(202);
    expect(await consultado()).toEqual(FRESCO);
  });

  it("pull_request: solo opened/closed/reopened", async () => {
    const pr = (action: string) => ({ action, repository: runMain.repository });
    expect((await enviar("pull_request", pr("labeled"))).status).toBe(202);
    expect(await consultado()).toEqual(FRESCO);
    expect((await enviar("pull_request", pr("opened"))).status).toBe(200);
    expect((await consultado()).getTime()).toBe(0);
  });

  it("repositorio no registrado: 202", async () => {
    const res = await enviar("release", {
      repository: { full_name: "otro/repo" },
    });
    expect(res.status).toBe(202);
    expect(await consultado()).toEqual(FRESCO);
  });

  it("evento no soportado: 202", async () => {
    expect((await enviar("push", runMain)).status).toBe(202);
  });

  it("cuerpo de más de 1 MB: 413", async () => {
    const grande = "x".repeat(1024 * 1024 + 1);
    expect((await enviar("release", null, { crudo: grande })).status).toBe(413);
    const declarado = await enviar("release", runMain, {
      headers: { "content-length": String(2 * 1024 * 1024) },
    });
    expect(declarado.status).toBe(413);
  });

  it("JSON inválido con firma válida: 400", async () => {
    expect(
      (await enviar("release", null, { crudo: "{no es json" })).status,
    ).toBe(400);
  });

  it("ping: 200", async () => {
    expect((await enviar("ping", { zen: "hola" })).status).toBe(200);
  });

  it("la limpieza borra entregas de más de 7 días", async () => {
    vi.stubEnv("CRON_SECRET", "secreto-de-cron-con-longitud-suficiente");
    const dias = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);
    await db.insert(githubDeliveries).values([
      { deliveryId: "vieja", receivedAt: dias(8) },
      { deliveryId: "reciente", receivedAt: dias(6) },
    ]);
    const res = await limpiar(
      new Request("http://localhost/api/monitor/cleanup", {
        headers: {
          authorization: "Bearer secreto-de-cron-con-longitud-suficiente",
        },
      }),
    );
    expect(await res.json()).toMatchObject({ deliveriesDeleted: 1 });
    const quedan = await db.select().from(githubDeliveries);
    expect(quedan.map((e) => e.deliveryId)).toEqual(["reciente"]);
  });
});
