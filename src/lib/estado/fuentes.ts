import { getDb } from "@/lib/db/client";
import { estadoRepositorio } from "@/lib/github/cliente";
import type { EstadoCi } from "@/lib/domain/semaforo";

/** CI de main desde GitHub (con caché y límite de peticiones del caso 4). */
export const ciDesdeGitHub = async (repo: string): Promise<EstadoCi> =>
  (await estadoRepositorio(getDb(), repo, { token: process.env.GITHUB_TOKEN }))
    .ci.estado;
