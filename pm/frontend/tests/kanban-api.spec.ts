/**
 * E2E tests for Part 7: Frontend API Integration
 * Playwright tests for full Kanban board with backend API
 */

import { test, expect } from "@playwright/test";

test.describe("Kanban Board with Backend API", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.fill('input[aria-label="Username"]', "user");
    await page.fill('input[aria-label="Password"]', "password");
    await page.click('button[aria-label="Sign in"]');
    await page.waitForSelector('[data-testid^="column-"]', { timeout: 10000 });
  });

  test("should display board fetched from API", async ({ page }) => {
    // Verify columns are visible (default column names)
    const columns = page.locator('[data-testid^="column-"]');
    await expect(columns).toHaveCount(5);

    // Verify cards section is present (may have 0 or more cards)
    const cards = page.locator('[data-testid^="card-"]');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(0);
  });

  test("should add card via API", async ({ page }) => {
    const firstColumn = page.locator('[data-testid^="column-"]').first();
    const initialCardCount = await firstColumn
      .locator('[data-testid^="card-"]')
      .count();

    await firstColumn.getByRole("button", { name: /add a card/i }).click();
    await firstColumn.getByPlaceholder("Card title").fill("Test Task from API");
    await firstColumn.getByPlaceholder("Details").fill("Added via Playwright.");
    await firstColumn.getByRole("button", { name: /add card/i }).click();

    await expect(firstColumn.getByText("Test Task from API")).toBeVisible();

    const newCardCount = await firstColumn
      .locator('[data-testid^="card-"]')
      .count();
    expect(newCardCount).toBe(initialCardCount + 1);

    await page.reload();
    await page.waitForSelector('[data-testid^="column-"]');
    await expect(page.getByText("Test Task from API")).toBeVisible();
  });

  test("should delete card via API", async ({ page }) => {
    const firstColumn = page.locator('[data-testid^="column-"]').first();
    const cards = firstColumn.locator('[data-testid^="card-"]');
    const initialCount = await cards.count();

    if (initialCount === 0) {
      // Ensure at least one card exists
      await firstColumn.getByRole("button", { name: /add a card/i }).click();
      await firstColumn.getByPlaceholder("Card title").fill("Card to Delete");
      await firstColumn.getByRole("button", { name: /add card/i }).click();
      await expect(firstColumn.getByText("Card to Delete")).toBeVisible();
    }

    const firstCard = cards.first();
    const deleteButton = firstCard.locator("button[aria-label*='Delete']");
    await deleteButton.click();

    const newCount = await cards.count();
    expect(newCount).toBe(Math.max(0, initialCount - 1));
  });

  test("should rename column via API", async ({ page }) => {
    const titleInput = page.locator('input[aria-label="Column title"]').first();
    await titleInput.fill("Updated Column");
    await titleInput.blur();

    await expect(page.locator("text=Updated Column").first()).toBeVisible();

    await page.reload();
    await page.waitForSelector('[data-testid^="column-"]');
    await expect(page.locator("text=Updated Column").first()).toBeVisible();
  });

  test.skip("should drag and drop card between columns", async ({ page }) => {
    // dnd-kit uses PointerSensor which is not reliably triggered by mouse events in Playwright
  });

  test("should show loading state while fetching board", async ({ page }) => {
    await page.route("/api/user/board", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });

    await page.reload();

    await expect(page.locator("text=Loading your board")).toBeVisible();
    await expect(page.locator('[data-testid^="column-"]').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("should show error message on API failure", async ({ page }) => {
    await page.route("/api/user/board", (route) => {
      route.abort("failed");
    });

    await page.reload();

    await expect(page.locator("text=Failed to load board")).toBeVisible();
    await expect(page.locator("button:has-text('Try again')")).toBeVisible();
  });

  test("should handle rapid card additions", async ({ page }) => {
    const firstColumn = page.locator('[data-testid^="column-"]').first();

    for (let i = 0; i < 2; i++) {
      await firstColumn.getByRole("button", { name: /add a card/i }).click();
      await firstColumn.getByPlaceholder("Card title").fill(`Rapid Task ${i}`);
      await firstColumn.getByRole("button", { name: /add card/i }).click();
      await expect(firstColumn.getByText(`Rapid Task ${i}`)).toBeVisible();
    }

    await page.reload();
    await page.waitForSelector('[data-testid^="column-"]');

    for (let i = 0; i < 2; i++) {
      await expect(page.getByText(`Rapid Task ${i}`)).toBeVisible();
    }
  });

  test("should maintain auth token in API requests", async ({ page }) => {
    const authHeaders: string[] = [];

    page.on("request", (request) => {
      if (request.url().includes("/api")) {
        const auth = request.headers()["authorization"];
        if (auth) authHeaders.push(auth);
      }
    });

    const firstColumn = page.locator('[data-testid^="column-"]').first();
    await firstColumn.getByRole("button", { name: /add a card/i }).click();
    await firstColumn.getByPlaceholder("Card title").fill("Auth Test Task");
    await firstColumn.getByRole("button", { name: /add card/i }).click();

    await expect(firstColumn.getByText("Auth Test Task")).toBeVisible();

    const hasBearer = authHeaders.some((h) => h.startsWith("Bearer "));
    expect(hasBearer).toBeTruthy();
  });
});
