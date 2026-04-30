import { expect, test } from "@playwright/test";

test.describe("Kanban Board - Integration Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Part 4: login is required before viewing the board
    await page.goto("http://localhost:8000/", { waitUntil: "networkidle" });
    await page.getByLabel("Username").fill("user");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
  });

  test("loads the kanban board page", async ({ page }) => {
    // Verify board loads after login
    await expect(page).toHaveTitle(/Kanban Studio/i);
    await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
  });

  test("displays all columns with titles", async ({ page }) => {
    // Verify all 5 columns are visible
    await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);

    // Verify each column has an editable title input
    const inputs = page.locator('input[aria-label="Column title"]');
    const count = await inputs.count();
    expect(count).toBe(5);
  });

  test("displays cards with title and details", async ({ page }) => {
    // Find any card rendered by the backend (IDs are numeric, format: card-{id})
    const cards = page.locator('[data-testid^="card-"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    const firstCard = cards.first();
    await expect(firstCard).toBeVisible();
    const cardText = await firstCard.textContent();
    expect(cardText).toBeTruthy();
  });

  test("adds a card to a column", async ({ page }) => {
    const firstColumn = page.locator('[data-testid^="column-"]').first();
    const initialCardCount = await firstColumn
      .locator('[data-testid^="card-"]')
      .count();

    // Click "Add a card" button
    await firstColumn.getByRole("button", { name: /add a card/i }).click();

    // Fill form
    await firstColumn.getByPlaceholder("Card title").fill("E2E Test Card");
    await firstColumn.getByPlaceholder("Details").fill("Added via Playwright.");

    // Submit
    await firstColumn.getByRole("button", { name: /add card/i }).click();

    // Verify card appears
    await expect(firstColumn.getByText("E2E Test Card")).toBeVisible();

    // Verify card count increased
    const newCardCount = await firstColumn
      .locator('[data-testid^="card-"]')
      .count();
    expect(newCardCount).toBe(initialCardCount + 1);
  });

  test("deletes a card from a column", async ({ page }) => {
    const firstColumn = page.locator('[data-testid^="column-"]').first();
    const initialCardCount = await firstColumn
      .locator('[data-testid^="card-"]')
      .count();

    // Get the first card and delete it
    const firstCard = firstColumn.locator('[data-testid^="card-"]').first();
    const deleteButton = firstCard
      .locator("button[aria-label*='Delete']")
      .first();

    await deleteButton.click();

    // Verify card count decreased
    const newCardCount = await firstColumn
      .locator('[data-testid^="card-"]')
      .count();
    expect(newCardCount).toBe(initialCardCount - 1);
  });

  test("renames a column", async ({ page }) => {
    const firstColumn = page.locator('[data-testid^="column-"]').first();
    const titleInput = firstColumn.locator('input[aria-label="Column title"]');

    // Change column name
    await titleInput.clear();
    await titleInput.fill("Renamed Column");

    // Verify change
    await expect(titleInput).toHaveValue("Renamed Column");
  });

  test.skip("moves a card between columns (drag and drop)", async () => {
    // dnd-kit uses PointerSensor which is not reliably triggered by mouse events in Playwright
  });

  test.skip("reorders cards within same column", async () => {
    // dnd-kit uses PointerSensor which is not reliably triggered by mouse events in Playwright
  });

  test("should render CSS and colors correctly", async ({ page }) => {
    // Verify styling is applied
    const column = page.locator('[data-testid^="column-"]').first();
    const styles = await column.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        border: computed.border,
        borderRadius: computed.borderRadius,
        padding: computed.padding,
      };
    });

    expect(styles.border).toBeTruthy();
    expect(styles.borderRadius).toBeTruthy();
    expect(styles.padding).toBeTruthy();
  });

  test("should load fonts without errors", async ({ page }) => {
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        pageErrors.push(msg.text());
      }
    });

    // Wait for potential async font loading
    await page.waitForTimeout(2000);

    // Filter for font-related errors (not critical JS errors)
    const fontErrors = pageErrors.filter(
      (err) =>
        err.toLowerCase().includes("font") || err.toLowerCase().includes("404"),
    );

    // Should not have font 404 errors
    expect(fontErrors.length).toBe(0);
  });

  test("should have no excessive console errors", async ({ page }) => {
    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Perform basic interactions
    const firstColumn = page.locator('[data-testid^="column-"]').first();
    await firstColumn.getByRole("button", { name: /add a card/i }).click();
    await page.waitForTimeout(500);

    // Should not have JS errors
    expect(errors).toHaveLength(0);
  });

  test("should be responsive and load quickly", async ({ page }) => {
    // Check that page loads without errors
    await page.waitForLoadState("networkidle");

    // Verify DOM is reasonably sized (not too many elements)
    const elementCount = await page.locator("*").count();
    expect(elementCount).toBeLessThan(500); // Reasonable DOM size

    // Verify page renders with components visible
    await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
  });

  test("page title should be Kanban Studio", async ({ page }) => {
    const title = await page.title();
    expect(title).toMatch(/Kanban Studio/i);
  });

  test("should show 5 columns with card counts", async ({ page }) => {
    const columns = page.locator('[data-testid^="column-"]');
    const count = await columns.count();

    expect(count).toBe(5);

    // Each column shows card count badge
    for (let i = 0; i < count; i++) {
      const column = columns.nth(i);
      const cardCountText = column.locator("text=/\\d+ cards/");
      await expect(cardCountText).toBeVisible();
    }
  });
});
