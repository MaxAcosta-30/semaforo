// Caso 6: checklist manual por versión y aprobación de la publicación.

import { and, desc, eq } from "drizzle-orm";
import type { getDb } from "@/lib/db/client";
import { checklistMarks, products, releaseApprovals } from "@/lib/db/schema";
import type { Motivo, ResultadoSemaforo } from "@/lib/domain/semaforo";

type Db = ReturnType<typeof getDb>;

export const CHECKLIST = [
  "Migraciones revisadas",
  "Notas de la versión escritas",
  "Probado en la vista previa",
  "Plan para volver atrás",
] as const;

export interface Renglon {
  texto: string;
  marcado: boolean;
  por: string | null;
  cuando: Date | null;
}

export interface Aprobacion {
  version: string;
  por: string;
  cuando: Date;
  color: string;
  motivos: Motivo[];
}

export async function checklistDe(db: Db, productId: string, version: string) {
  const marcas = await db
    .select()
    .from(checklistMarks)
    .where(
      and(
        eq(checklistMarks.productId, productId),
        eq(checklistMarks.version, version),
      ),
    );
  const renglones: Renglon[] = CHECKLIST.map((texto) => {
    const m = marcas.find((x) => x.item === texto);
    return {
      texto,
      marcado: Boolean(m),
      por: m?.marcadoPor ?? null,
      cuando: m?.marcadoAt ?? null,
    };
  });
  return { version, renglones, completa: renglones.every((r) => r.marcado) };
}

export async function marcar(
  db: Db,
  productId: string,
  version: string,
  item: string,
  marcado: boolean,
  quien: string,
  ahora = new Date(),
) {
  if (!(CHECKLIST as readonly string[]).includes(item))
    return {
      ok: false as const,
      error: "Ese renglón no existe en la checklist.",
    };
  if (marcado) {
    await db
      .insert(checklistMarks)
      .values({ productId, version, item, marcadoPor: quien, marcadoAt: ahora })
      .onConflictDoNothing();
  } else {
    await db
      .delete(checklistMarks)
      .where(
        and(
          eq(checklistMarks.productId, productId),
          eq(checklistMarks.version, version),
          eq(checklistMarks.item, item),
        ),
      );
  }
  return { ok: true as const };
}

export type ResultadoAprobar =
  | { ok: true; aprobacion: Aprobacion }
  | { ok: false; estado: 409; error: string };

/**
 * Guarda quién aprobó, cuándo y el color con sus motivos en ese momento.
 * Con rojo no se puede aprobar; una versión se aprueba una sola vez.
 */
export async function aprobar(
  db: Db,
  productId: string,
  version: string,
  semaforo: ResultadoSemaforo,
  quien: string,
  ahora = new Date(),
): Promise<ResultadoAprobar> {
  if (semaforo.color === "rojo") {
    return {
      ok: false,
      estado: 409,
      error: `No se puede aprobar en rojo: ${semaforo.motivos[0]?.texto ?? ""}`,
    };
  }
  const filas = await db
    .insert(releaseApprovals)
    .values({
      productId,
      version,
      aprobadoPor: quien,
      aprobadoAt: ahora,
      color: semaforo.color,
      motivos: semaforo.motivos,
    })
    .onConflictDoNothing()
    .returning();
  if (filas.length === 0)
    return {
      ok: false,
      estado: 409,
      error: `La versión ${version} ya estaba aprobada.`,
    };
  return {
    ok: true,
    aprobacion: {
      version,
      por: quien,
      cuando: ahora,
      color: semaforo.color,
      motivos: semaforo.motivos,
    },
  };
}

export async function aprobacionesDe(
  db: Db,
  productId: string,
): Promise<Aprobacion[]> {
  const filas = await db
    .select()
    .from(releaseApprovals)
    .where(eq(releaseApprovals.productId, productId))
    .orderBy(desc(releaseApprovals.aprobadoAt))
    .limit(10);
  return filas.map((f) => ({
    version: f.version,
    por: f.aprobadoPor,
    cuando: f.aprobadoAt,
    color: f.color,
    motivos: f.motivos as Motivo[],
  }));
}

export async function productoPorSlug(db: Db, slug: string) {
  const [p] = await db.select().from(products).where(eq(products.slug, slug));
  return p ?? null;
}
