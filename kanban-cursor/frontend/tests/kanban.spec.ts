import { test, expect } from "@playwright/test";

test("renderiza tablero con columnas y permite crear tarjeta", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Product Launch Board" })).toBeVisible();
  await expect(page.getByLabel("Nombre de columna Backlog")).toBeVisible();
  await expect(page.getByLabel("Nombre de columna To Do")).toBeVisible();
  await expect(page.getByLabel("Nombre de columna In Progress")).toBeVisible();
  await expect(page.getByLabel("Nombre de columna Review")).toBeVisible();
  await expect(page.getByLabel("Nombre de columna Done")).toBeVisible();

  await page
    .getByTestId("add-title-column-backlog")
    .fill("Tarea e2e");
  await page
    .getByTestId("add-details-column-backlog")
    .fill("Detalle creado desde Playwright");
  await page.getByTestId("add-button-column-backlog").click();

  await expect(page.getByText("Tarea e2e")).toBeVisible();
  await expect(page.getByText("Detalle creado desde Playwright")).toBeVisible();
});
