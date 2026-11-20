import { http, HttpResponse, type JsonBodyType } from "msw";
import { setupServer } from "msw/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { getDb } from "@/lib/db/client";
import { githubRateLimit, githubSnapshots } from "@/lib/db/schema";
import {
  API,
  estadoRepositorio,
  FRESCURA_MS,
  repoValido,
} from "@/lib/github/cliente";

const db = getDb();
const REPO = "MaxAcosta-30/hito";
const T0 = new Date("2026-11-19T12:00:00Z");
let reloj = T0;
const ahora = () => reloj;
const despues = (ms: number) => (reloj = new Date(reloj.getTime() + ms));

const peticiones: Request[] = [];
let estadoCi: { status: string; conclusion: string | null } = {
  status: "completed",
  conclusion: "success",
};
let releases = true;
let restantes = 4999;
let caido = false;

const limite = () => ({
  etag: '"v1"',
  "x-ratelimit-remaining": String(restantes),
  "x-ratelimit-reset": String(Math.floor(T0.getTime() / 1000) + 3600),
});
const conEtag = (req: Request, cuerpo: JsonBodyType) =>
  caido
    ? new HttpResponse(null, { status: 502 })
    : req.headers.get("if-none-match") === '"v1"'
      ? new HttpResponse(null, { status: 304, headers: limite() })
      : HttpResponse.json(cuerpo, { headers: limite() });

const servidor = setupServer(
  http.get(`${API}/repos/:o/:r/actions/runs`, ({ request }) => {
    peticiones.push(request);
    return conEtag(request, {
      workflow_runs: [
        {
          ...estadoCi,
          html_url: "https://github.com/x/runs/1",
          updated_at: "2026-11-19T11:50:00Z",
        },
      ],
    });
  }),
  http.get(`${API}/repos/:o/:r/releases/latest`, ({ request }) => {
    peticiones.push(request);
    if (!releases)
      return HttpResponse.json(
        { message: "Not Found" },
        { status: 404, headers: limite() },
      );
    return conEtag(request, {
      tag_name: "v1.4.0",
      published_at: "2026-11-10T00:00:00Z",
      html_url: "https://github.com/x/r",
    });
  }),
  http.get(`${API}/repos/:o/:r/pulls`, ({ request }) => {
    peticiones.push(request);
    return conEtag(request, [
      {
        number: 46,
        title: "Auditoría de seguridad",
        html_url: "https://github.com/x/pull/46",
      },
    ]);
  }),
);

beforeAll(() => servidor.listen({ onUnhandledFrame: "error" }));
afterAll(() => servidor.close());
beforeEach(async () => {
  reloj = T0;
  peticiones.length = 0;
  estadoCi = { status: "completed", conclusion: "success" };
  releases = true;
  restantes = 4999;
  caido = false;
  await db.delete(githubSnapshots);
  await db.delete(githubRateLimit);
});
afterEach(() => servidor.resetHandlers());

describe("estadoRepositorio", () => {
  it("trae CI, último release y PRs abiertos, autenticado", async () => {
    const r = await estadoRepositorio(db, REPO, {
      ahora,
      token: "token-de-solo-lectura",
    });

    expect(r.ci.estado).toBe("exito");
    expect(r.release?.tag).toBe("v1.4.0");
    expect(r.prs).toEqual([
      {
        numero: 46,
        titulo: "Auditoría de seguridad",
        url: "https://github.com/x/pull/46",
      },
    ]);
    expect(r.avisos).toEqual([]);
    expect(peticiones).toHaveLength(3);
    expect(
      peticiones.every(
        (p) =>
          p.headers.get("authorization") === "Bearer token-de-solo-lectura",
      ),
    ).toBe(true);
    // Solo el CI de los push a main: las corridas programadas del monitor no cuentan
    expect(new URL(peticiones[0]!.url).searchParams.get("event")).toBe("push");
  });

  it("con datos frescos no vuelve a llamar a GitHub", async () => {
    await estadoRepositorio(db, REPO, { ahora });
    despues(FRESCURA_MS - 1000);
    await estadoRepositorio(db, REPO, { ahora });
    expect(peticiones).toHaveLength(3);
  });

  it("después de 5 min pregunta con ETag y un 304 conserva los datos", async () => {
    await estadoRepositorio(db, REPO, { ahora });
    despues(FRESCURA_MS + 1000);
    const r = await estadoRepositorio(db, REPO, { ahora });

    expect(peticiones).toHaveLength(6);
    expect(
      peticiones
        .slice(3)
        .every((p) => p.headers.get("if-none-match") === '"v1"'),
    ).toBe(true);
    expect(r.release?.tag).toBe("v1.4.0");
    expect(r.consultado).toEqual(reloj);
  });

  it("cuando GitHub avisa que queda poco límite deja de pedir y sirve la caché", async () => {
    await estadoRepositorio(db, REPO, { ahora });
    despues(FRESCURA_MS + 1000);
    restantes = 3; // la siguiente respuesta dice que quedan 3
    const r = await estadoRepositorio(db, REPO, { ahora });

    // Solo la primera petición (CI) sale; release y PRs ya no se piden
    expect(peticiones).toHaveLength(4);
    expect(r.release?.tag).toBe("v1.4.0");
    expect(r.avisos).toHaveLength(2);
    expect(r.avisos[0]).toContain("Límite de GitHub casi agotado");

    // Pasado x-ratelimit-reset vuelve a pedir
    reloj = new Date(T0.getTime() + 3600_000 + 1000);
    restantes = 4999;
    await estadoRepositorio(db, REPO, { ahora });
    expect(peticiones.length).toBeGreaterThan(4);
  });

  it("si GitHub falla sirve el último dato guardado y lo dice", async () => {
    await estadoRepositorio(db, REPO, { ahora });
    despues(FRESCURA_MS + 1000);
    caido = true;
    const r = await estadoRepositorio(db, REPO, { ahora });

    expect(r.release?.tag).toBe("v1.4.0");
    expect(r.consultado).toEqual(T0); // el dato es de antes
    expect(r.avisos).toHaveLength(3);
  });

  it.each([
    [{ status: "completed", conclusion: "failure" }, "fallo"],
    [{ status: "in_progress", conclusion: null }, "en_curso"],
    [{ status: "completed", conclusion: "cancelled" }, "desconocido"],
  ] as const)("traduce el CI %o a %s", async (run, esperado) => {
    estadoCi = run;
    expect((await estadoRepositorio(db, REPO, { ahora })).ci.estado).toBe(
      esperado,
    );
  });

  it("un repositorio sin releases no es un error", async () => {
    releases = false;
    const r = await estadoRepositorio(db, REPO, { ahora });
    expect(r.release).toBeNull();
    expect(r.avisos).toEqual([]);
  });

  it.each([
    "../../etc",
    "dueno",
    "dueno/repo/extra",
    "dueno/re po",
    "dueno/..",
    "a?b/c",
  ])("rechaza el repositorio %s antes de llamar a GitHub", async (repo) => {
    expect(repoValido(repo)).toBe(false);
    await expect(estadoRepositorio(db, repo, { ahora })).rejects.toThrow(
      "Repositorio inválido",
    );
    expect(peticiones).toHaveLength(0);
  });
});
