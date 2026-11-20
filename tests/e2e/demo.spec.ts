import { expect, test } from "@playwright/test";

test("entrar como demo, abrir un producto y ver el semáforo con su motivo", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/entrar/); // sin sesión no se ve el tablero

  await page.getByRole("button", { name: "Entrar como demo" }).click();
  await expect(
    page.getByRole("heading", { name: "¿Se puede liberar?" }),
  ).toBeVisible();
  await expect(page.getByText("Demo (solo lectura)")).toBeVisible();

  // La API de ejemplo tiene un incidente abierto: rojo, con su motivo visible.
  const fila = page.getByRole("listitem").filter({ hasText: "API de ejemplo" });
  await expect(fila.getByText("Rojo · alto")).toBeVisible();
  await expect(fila.getByText("Hay un incidente abierto.")).toBeVisible();

  await page.getByRole("link", { name: "API de ejemplo" }).click();
  // Acotado a la sección del producto: durante la navegación la fila del tablero sigue en el DOM.
  const detalle = page.getByRole("region", { name: "API de ejemplo" });
  await expect(detalle.getByText("Rojo · alto")).toBeVisible();
  await expect(detalle.getByText("Hay un incidente abierto.")).toBeVisible();
  await expect(
    page.getByText("Respondió 500; se esperaba 200 · en curso"),
  ).toBeVisible();
});

test("la página pública muestra solo productos públicos", async ({ page }) => {
  await page.goto("/status/hito");
  await expect(page.getByRole("heading", { name: "Hito" })).toBeVisible();
  await expect(page.getByText("Disponibilidad 24 h")).toBeVisible();

  await page.goto("/status/api-ejemplo"); // privado
  await expect(page.getByText("API de ejemplo")).toHaveCount(0);
});
