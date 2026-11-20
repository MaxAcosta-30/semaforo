import { defineConfig } from "@playwright/test";

// E2E del CLAUDE.md: entrar como demo → abrir un producto → ver el semáforo y su motivo.
// Corre contra el build de producción (`pnpm build` antes) con la semilla de tests/e2e.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm start -p 3100",
    url: "http://localhost:3100/entrar",
    reuseExistingServer: false,
    env: {
      NEXTAUTH_URL: "http://localhost:3100",
      NEXTAUTH_SECRET:
        process.env.NEXTAUTH_SECRET ?? "solo-para-e2e-local-no-es-un-secreto",
    },
  },
});
