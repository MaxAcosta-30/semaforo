import { createHash, timingSafeEqual } from "node:crypto";

const sha256 = (value: string) => createHash("sha256").update(value).digest();

/**
 * Valida `Authorization: Bearer <MONITOR_SECRET>` sin filtrar el secreto por tiempos.
 * Se comparan los hashes porque timingSafeEqual exige buffers del mismo largo.
 * Sin secreto configurado se rechaza todo.
 */
export function isMonitorAuthorized(
  header: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !header?.startsWith("Bearer ")) return false;
  return timingSafeEqual(
    sha256(header.slice("Bearer ".length)),
    sha256(secret),
  );
}
