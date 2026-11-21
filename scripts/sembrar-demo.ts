// Uso: pnpm db:demo   (lee DATABASE_URL de .env)
// Solo corre contra una base local, salvo que se pida explícitamente con DEMO_BASE_REMOTA=1.
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

const url = process.env.DATABASE_URL ?? "";
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();
if (
  !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) &&
  process.env.DEMO_BASE_REMOTA !== "1"
) {
  console.error(
    "La base no es local. Para sembrar una base remota, ejecuta con DEMO_BASE_REMOTA=1.",
  );
  process.exit(1);
}

const { getDb } = await import("@/lib/db/client");
const { sembrarDemo } = await import("@/lib/demo/sembrar");
console.table(await sembrarDemo(getDb()));
process.exit(0);
