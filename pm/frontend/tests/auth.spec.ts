import { expect, test } from "@playwright/test";

test.describe("Authentication flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
  });

  test("logs in with valid credentials and shows the kanban board", async ({
    page,
  }) => {
    await page.getByLabel("Username").fill("user");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
    await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
  });

  test("shows an error for invalid credentials", async ({ page }) => {
    await page.getByLabel("Username").fill("user");
    await page.getByLabel("Password").fill("wrong");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeEnabled();
  });

  test("logs out and returns to login screen", async ({ page }) => {
    await page.getByLabel("Username").fill("user");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
    await page.getByRole("button", { name: /sign out/i }).click();

    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("persists login state after reload", async ({ page }) => {
    await page.getByLabel("Username").fill("user");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();

    await page.reload({ waitUntil: "networkidle" });

    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
    const authData = await page.evaluate(() =>
      window.localStorage.getItem("kanban_auth"),
    );
    expect(authData).not.toBeNull();
    const parsed = JSON.parse(authData ?? "null");
    expect(parsed.username).toBe("user");
    expect(parsed.token).toBeTruthy();
  });
});
