// Caso 4: estado del repositorio con la API REST de GitHub (CI de main, último release y
// PRs abiertos), con caché y respetando el límite de peticiones.
//
// - Datos frescos (menos de 5 min): se usan sin tocar la red.
// - Si no: petición condicional con If-None-Match. Un 304 autenticado no gasta límite
//   (docs.github.com, "Best practices for using the REST API", verificado el 2026-11-19).
// - Si quedan RESERVA peticiones o menos y no ha pasado x-ratelimit-reset: se sirve la caché.
// - Si GitHub falla, se sirve la caché y se dice desde cuándo.

import { and, eq } from "drizzle-orm";
import type { getDb } from "@/lib/db/client";
import { githubRateLimit, githubSnapshots } from "@/lib/db/schema";
import type { EstadoCi } from "@/lib/domain/semaforo";
import { repoValido } from "@/lib/productos/esquema";

type Db = ReturnType<typeof getDb>;

export const API = "https://api.github.com";
export const FRESCURA_MS = 5 * 60_000;
export const RESERVA = 5;

export interface Ci {
  estado: EstadoCi;
  url: string | null;
  fecha: string | null;
}
export interface Release {
  tag: string;
  fecha: string;
  url: string;
}
export interface Pr {
  numero: number;
  titulo: string;
  url: string;
}

export interface EstadoRepo {
  ci: Ci;
  release: Release | null;
  prs: Pr[];
  /** Fecha del dato más viejo mostrado. */
  consultado: Date;
  /** Si algún dato es más viejo que FRESCURA_MS porque no se pudo actualizar. */
  avisos: string[];
}

interface Opciones {
  token?: string;
  ahora?: () => Date;
}

export { repoValido };

export async function estadoRepositorio(
  db: Db,
  repo: string,
  opciones: Opciones = {},
): Promise<EstadoRepo> {
  if (!repoValido(repo)) throw new Error(`Repositorio inválido: ${repo}`);
  const ahora = opciones.ahora ?? (() => new Date());
  const avisos: string[] = [];

  const ci = await recurso<Ci>(
    db,
    repo,
    "ci",
    `/repos/${repo}/actions/runs?branch=main&event=push&per_page=1`,
    aCi,
    opciones,
    ahora,
    avisos,
  );
  const release = await recurso<Release | null>(
    db,
    repo,
    "release",
    `/repos/${repo}/releases/latest`,
    aRelease,
    opciones,
    ahora,
    avisos,
  );
  const prs = await recurso<Pr[]>(
    db,
    repo,
    "prs",
    `/repos/${repo}/pulls?state=open&per_page=100`,
    aPrs,
    opciones,
    ahora,
    avisos,
  );

  return {
    ci: ci.datos ?? { estado: "desconocido", url: null, fecha: null },
    release: release.datos ?? null,
    prs: prs.datos ?? [],
    consultado: new Date(
      Math.min(
        ci.fecha.getTime(),
        release.fecha.getTime(),
        prs.fecha.getTime(),
      ),
    ),
    avisos,
  };
}

async function recurso<T>(
  db: Db,
  repo: string,
  nombre: "ci" | "release" | "prs",
  ruta: string,
  convertir: (cuerpo: unknown, status: number) => T,
  { token }: Opciones,
  ahora: () => Date,
  avisos: string[],
): Promise<{ datos: T | null; fecha: Date }> {
  const [cache] = await db
    .select()
    .from(githubSnapshots)
    .where(
      and(eq(githubSnapshots.repo, repo), eq(githubSnapshots.recurso, nombre)),
    );
  const momento = ahora();
  const deCache = () => ({
    datos: (cache?.datos as T | undefined) ?? null,
    fecha: cache?.consultadoAt ?? momento,
  });

  if (cache && momento.getTime() - cache.consultadoAt.getTime() < FRESCURA_MS)
    return deCache();

  const [limite] = await db.select().from(githubRateLimit);
  if (limite && limite.remaining <= RESERVA && limite.resetAt > momento) {
    avisos.push(
      `Límite de GitHub casi agotado: se actualiza después de las ${limite.resetAt.toISOString()}.`,
    );
    return deCache();
  }

  let res: Response;
  try {
    res = await fetch(`${API}${ruta}`, {
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "Semaforo",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(cache?.etag ? { "if-none-match": cache.etag } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    avisos.push(
      `GitHub no respondió (${nombre}); se muestra el último dato guardado.`,
    );
    return deCache();
  }
  await guardarLimite(db, res, momento);

  if (res.status === 304 && cache) {
    await db
      .update(githubSnapshots)
      .set({ consultadoAt: momento })
      .where(
        and(
          eq(githubSnapshots.repo, repo),
          eq(githubSnapshots.recurso, nombre),
        ),
      );
    return { datos: (cache.datos as T) ?? null, fecha: momento };
  }
  if (!res.ok && !(nombre === "release" && res.status === 404)) {
    avisos.push(
      `GitHub respondió ${res.status} (${nombre}); se muestra el último dato guardado.`,
    );
    return deCache();
  }

  const cuerpo = res.status === 404 ? null : await res.json();
  const datos = convertir(cuerpo, res.status);
  const fila = {
    repo,
    recurso: nombre,
    etag: res.headers.get("etag"),
    datos,
    consultadoAt: momento,
  };
  await db
    .insert(githubSnapshots)
    .values(fila)
    .onConflictDoUpdate({
      target: [githubSnapshots.repo, githubSnapshots.recurso],
      set: fila,
    });
  return { datos, fecha: momento };
}

async function guardarLimite(db: Db, res: Response, momento: Date) {
  const restantes = Number(res.headers.get("x-ratelimit-remaining"));
  const reinicio = Number(res.headers.get("x-ratelimit-reset"));
  if (
    !res.headers.has("x-ratelimit-remaining") ||
    !Number.isFinite(restantes) ||
    !Number.isFinite(reinicio)
  )
    return;
  const fila = {
    id: 1,
    remaining: restantes,
    resetAt: new Date(reinicio * 1000),
    updatedAt: momento,
  };
  await db
    .insert(githubRateLimit)
    .values(fila)
    .onConflictDoUpdate({ target: githubRateLimit.id, set: fila });
}

interface RunGh {
  status: string;
  conclusion: string | null;
  html_url: string;
  updated_at: string;
}

export function aCi(cuerpo: unknown): Ci {
  const run = (cuerpo as { workflow_runs?: RunGh[] })?.workflow_runs?.[0];
  if (!run) return { estado: "desconocido", url: null, fecha: null };
  let estado: EstadoCi = "desconocido";
  if (run.status !== "completed") estado = "en_curso";
  else if (run.conclusion === "success") estado = "exito";
  else if (
    ["failure", "timed_out", "startup_failure", "action_required"].includes(
      run.conclusion ?? "",
    )
  )
    estado = "fallo";
  return { estado, url: run.html_url, fecha: run.updated_at };
}

export function aRelease(cuerpo: unknown, status: number): Release | null {
  if (status === 404 || !cuerpo) return null; // el repo todavía no tiene releases
  const r = cuerpo as {
    tag_name: string;
    published_at: string;
    html_url: string;
  };
  return { tag: r.tag_name, fecha: r.published_at, url: r.html_url };
}

export function aPrs(cuerpo: unknown): Pr[] {
  return (
    (cuerpo as { number: number; title: string; html_url: string }[]) ?? []
  ).map((p) => ({
    numero: p.number,
    titulo: p.title,
    url: p.html_url,
  }));
}
