import { test, expect } from "@playwright/test";

test("delete card button should remove card", async ({ page }) => {
  await page.goto("/");

  // Wait for the board to load
  await expect(page.locator("text=Kanban Board MVP")).toBeVisible();

  // Verify initial card exists
  await expect(page.locator("text=Diseñar esquema")).toBeVisible();

  // Click delete button
  const deleteButton = page.locator(
    'button[aria-label="Eliminar Diseñar esquema"]',
  );
  console.log("Delete button found:", await deleteButton.count());

  await deleteButton.click();

  // Verify card is deleted
  await expect(page.locator("text=Diseñar esquema")).not.toBeVisible();
});
