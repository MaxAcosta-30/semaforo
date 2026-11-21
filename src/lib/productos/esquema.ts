// Esquema del caso 2 compartido por el servidor (API) y el formulario (cliente).
// Solo puede importar zod: nada de base de datos ni de Node.

import { z } from "zod";

export const REPO_VALIDO = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;

export function repoValido(repo: string): boolean {
  return REPO_VALIDO.test(repo) && !repo.includes("..");
}

/** Slug sugerido desde el nombre: minúsculas, sin acentos, solo [a-z0-9-], máximo 60. */
export function slugDesde(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export const esquemaProducto = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "Escribe el nombre.")
    .max(80, "Máximo 80 caracteres."),
  slug: z
    .string()
    .trim()
    .min(1, "Escribe el slug (se genera desde el nombre).")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Solo minúsculas, números y guiones (por ejemplo: mi-tienda).",
    )
    .max(60, "Máximo 60 caracteres.")
    .refine((s) => s !== "nuevo", "«nuevo» está reservado; elige otro slug."),
  repo: z
    .string()
    .trim()
    .refine(repoValido, "Usa el formato dueño/repositorio."),
  publico: z.boolean().default(false),
  endpoints: z
    .array(
      z.object({
        url: z
          .string()
          .trim()
          .min(1, "Escribe la URL.")
          .max(500, "Máximo 500 caracteres."),
        estadoEsperado: z
          .number("Escribe un número.")
          .int("Usa un número entero.")
          .min(100, "Entre 100 y 599.")
          .max(599, "Entre 100 y 599.")
          .default(200),
        latenciaMaximaMs: z
          .number("Escribe un número.")
          .int("Usa un número entero.")
          .min(50, "Entre 50 y 10 000 ms.")
          .max(10_000, "Entre 50 y 10 000 ms.")
          .default(1000),
      }),
    )
    .min(1, "Agrega al menos un endpoint.")
    .max(5, "Máximo 5 endpoints por producto."),
});

export type EntradaProducto = z.input<typeof esquemaProducto>;
