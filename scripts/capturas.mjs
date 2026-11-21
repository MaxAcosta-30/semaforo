// Captura la app local (build de producción en :3100 con la semilla de tests/e2e/semilla.sql).
// Uso: node scripts/capturas.mjs
import { chromium } from "@playwright/test";

const base = "http://localhost:3100";
const tamanos = {
  escritorio: { width: 1440, height: 900 },
  celular: { width: 390, height: 844 },
};
const navegador = await chromium.launch();

for (const [tam, viewport] of Object.entries(tamanos)) {
  for (const tema of ["claro", "oscuro"]) {
    const ctx = await navegador.newContext({
      viewport,
      colorScheme: tema === "oscuro" ? "dark" : "light",
    });
    const page = await ctx.newPage();
    const sufijo = `${tam}-${tema}`;
    await page.goto(`${base}/status/hito`);
    await page.getByRole("heading", { name: "Hito" }).waitFor();
    await page.screenshot({
      path: `docs/capturas/estado-publico-${sufijo}.png`,
      fullPage: true,
    });
    await page.goto(`${base}/entrar`);
    await page.getByRole("button", { name: "Entrar como demo" }).click();
    await page.getByRole("heading", { name: "¿Se puede liberar?" }).waitFor();
    await page.screenshot({
      path: `docs/capturas/tablero-${sufijo}.png`,
      fullPage: true,
    });
    await page.getByRole("link", { name: "API de ejemplo" }).click();
    await page.getByRole("region", { name: "API de ejemplo" }).waitFor();
    await page.getByText("Respondió 500; se esperaba 200 · en curso").waitFor();
    await page.screenshot({
      path: `docs/capturas/detalle-rojo-${sufijo}.png`,
      fullPage: true,
    });
    await ctx.close();
  }
}
await navegador.close();
