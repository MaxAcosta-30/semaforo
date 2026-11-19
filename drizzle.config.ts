import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Node ya sabe leer .env; no hace falta dotenv.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
});
