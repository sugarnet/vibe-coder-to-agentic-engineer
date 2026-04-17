/**
 * E2E tests for Part 7: Frontend API Integration
 * Playwright tests for full Kanban board with backend API
 */

import { test, expect } from "@playwright/test";

test.describe("Kanban Board with Backend API", () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto("/");
    await page.fill('input[placeholder*="Username"]', "user");
    await page.fill('input[placeholder*="Password"]', "password");
    await page.click("button:has-text('Sign In')");

    // Wait for board to load
    await page.waitForSelector("text=Kanban Studio");
  });

  test("should display board fetched from API", async ({ page }) => {
    // Verify columns are visible
    await expect(page.locator("text=To Do")).toBeVisible();
    await expect(page.locator("text=In Progress")).toBeVisible();
    await expect(page.locator("text=Review")).toBeVisible();
    await expect(page.locator("text=Done")).toBeVisible();
    await expect(page.locator("text=Backlog")).toBeVisible();

    // Verify cards are loaded from API
    const cards = await page.locator("[data-testid='card']").count();
    expect(cards).toBeGreaterThan(0);
  });

  test("should add card via API", async ({ page }) => {
    // Get initial card count
    const initialCardCount = await page
      .locator("[data-testid='card']")
      .count();

    // Add a new card
    await page.click("button:has-text('Add')");
    await page.fill('input[placeholder*="New task"]', "Test Task from API");
    await page.click("button:has-text('Add Card')");

    // Wait for card to appear
    await expect(page.locator("text=Test Task from API")).toBeVisible();

    // Verify card count increased
    const newCardCount = await page
      .locator("[data-testid='card']")
      .count();
    expect(newCardCount).toBe(initialCardCount + 1);

    // Refresh page and verify card persists
    await page.reload();
    await page.waitForSelector("text=Kanban Studio");
    await expect(page.locator("text=Test Task from API")).toBeVisible();
  });

  test("should delete card via API", async ({ page }) => {
    // Find a card to delete
    const cards = page.locator("[data-testid='card']");
    const firstCard = cards.first();
    const cardText = await firstCard.innerText();

    const initialCardCount = await cards.count();

    // Hover over card and click delete
    await firstCard.hover();
    await firstCard.locator("button[title='Delete']").click();

    // Confirm delete
    await page.click("button:has-text('Confirm')");

    // Wait for card to disappear
    await expect(firstCard).not.toBeVisible();

    // Verify card count decreased
    const newCardCount = await page
      .locator("[data-testid='card']")
      .count();
    expect(newCardCount).toBe(initialCardCount - 1);

    // Refresh page and verify deletion persists
    await page.reload();
    await page.waitForSelector("text=Kanban Studio");
    await expect(page.locator(`text=${cardText}`)).not.toBeVisible();
  });

  test("should rename column via API", async ({ page }) => {
    // Find a column header
    const columnHeader = page.locator("[data-testid='column-header']").first();

    // Click to edit
    await columnHeader.click();
    await page.fill('input[placeholder*="Column name"]', "Updated Column");
    await page.press('input[placeholder*="Column name"]', "Enter");

    // Verify update
    await expect(page.locator("text=Updated Column")).toBeVisible();

    // Refresh and verify persistence
    await page.reload();
    await page.waitForSelector("text=Kanban Studio");
    await expect(page.locator("text=Updated Column")).toBeVisible();
  });

  test("should drag and drop card between columns", async ({ page }) => {
    // Get first card and its column
    const firstCard = page.locator("[data-testid='card']").first();
    const cardText = await firstCard.innerText();

    // Get target column
    const targetColumn = page.locator("[data-testid='column']").nth(1);

    // Drag and drop
    await firstCard.dragTo(targetColumn);

    // Verify card moved in UI
    const cardInTargetColumn = targetColumn.locator(`text=${cardText}`);
    await expect(cardInTargetColumn).toBeVisible();

    // Refresh and verify persistence
    await page.reload();
    await page.waitForSelector("text=Kanban Studio");
    await expect(targetColumn.locator(`text=${cardText}`)).toBeVisible();
  });

  test("should show loading state while fetching board", async ({ page }) => {
    // Intercept the API call and delay it
    await page.route("/api/user/board", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });

    // Reload to trigger fetch
    await page.reload();

    // Should show loading spinner
    await expect(page.locator("text=Loading your board")).toBeVisible();

    // Eventually should show board
    await expect(page.locator("text=Kanban Studio")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should show error message on API failure", async ({ page }) => {
    // Intercept and fail the API call
    await page.route("/api/user/board", (route) => {
      route.abort("failed");
    });

    // Reload to trigger failed fetch
    await page.reload();

    // Should show error message
    await expect(
      page.locator("text=Failed to load board")
    ).toBeVisible();

    // Try again button should exist
    await expect(page.locator("button:has-text('Try again')")).toBeVisible();
  });

  test("should handle rapid updates without race conditions", async ({
    page,
  }) => {
    // Add multiple cards rapidly
    for (let i = 0; i < 3; i++) {
      await page.click("button:has-text('Add')");
      await page.fill(
        'input[placeholder*="New task"]',
        `Rapid Task ${i}`
      );
      await page.click("button:has-text('Add Card')");
    }

    // Verify all cards appear
    for (let i = 0; i < 3; i++) {
      await expect(page.locator(`text=Rapid Task ${i}`)).toBeVisible();
    }

    // Refresh and verify all cards persisted
    await page.reload();
    await page.waitForSelector("text=Kanban Studio");

    for (let i = 0; i < 3; i++) {
      await expect(page.locator(`text=Rapid Task ${i}`)).toBeVisible();
    }
  });

  test("should show transient error notifications", async ({ page }) => {
    // Intercept card creation and fail it
    let failOnce = true;
    await page.route("/api/cards", (route) => {
      if (failOnce) {
        failOnce = false;
        route.abort("failed");
      } else {
        route.continue();
      }
    });

    // Try to add a card (will fail)
    await page.click("button:has-text('Add')");
    await page.fill(
      'input[placeholder*="New task"]',
      "Failed Task"
    );
    await page.click("button:has-text('Add Card')");

    // Should show error notification
    await expect(page.locator("text=/Failed to/")).toBeVisible();

    // Error should disappear after a few seconds
    await page.waitForTimeout(4500);
    await expect(page.locator("text=/Failed to/")).not.toBeVisible();
  });

  test("should maintain auth token in API requests", async ({ page }) => {
    // Monitor all API requests
    const requests: { authorization?: string }[] = [];

    await page.on("request", (request) => {
      if (request.url().includes("/api")) {
        const authHeader = request.headerValue("authorization");
        requests.push({ authorization: authHeader });
      }
    });

    // Perform an action that makes an API call
    await page.click("button:has-text('Add')");
    await page.fill(
      'input[placeholder*="New task"]',
      "Auth Test Task"
    );
    await page.click("button:has-text('Add Card')");

    // Wait a bit for requests to complete
    await page.waitForTimeout(500);

    // Verify at least one request had an Authorization header
    const hasAuth = requests.some((req) => req.authorization?.startsWith("Bearer"));
    expect(hasAuth).toBeTruthy();
  });

  test("should persist data across page refresh", async ({ page }) => {
    // Add a card
    await page.click("button:has-text('Add')");
    await page.fill(
      'input[placeholder*="New task"]',
      "Persistence Test"
    );
    await page.click("button:has-text('Add Card')");

    // Rename a column
    const columnHeader = page.locator("[data-testid='column-header']").first();
    await columnHeader.click();
    await page.fill(
      'input[placeholder*="Column name"]',
      "Custom Column"
    );
    await page.press('input[placeholder*="Column name"]', "Enter");

    // Move a card
    const cards = await page.locator("[data-testid='card']").count();

    // Refresh page
    await page.reload();
    await page.waitForSelector("text=Kanban Studio");

    // Verify all changes persisted
    await expect(page.locator("text=Persistence Test")).toBeVisible();
    await expect(page.locator("text=Custom Column")).toBeVisible();

    const cardCountAfter = await page
      .locator("[data-testid='card']")
      .count();
    expect(cardCountAfter).toBeGreaterThan(0);
  });
});
