import { expect, test } from "@playwright/test";

test("kanban flow", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Kanban Atlas")).toBeVisible();

  const backlog = page.getByTestId("column-col-backlog");
  await backlog
    .getByLabel("Add card title for Backlog")
    .fill("QA review");
  await backlog
    .getByLabel("Add card details for Backlog")
    .fill("Run through the acceptance checklist.");
  await backlog.getByRole("button", { name: "Add card" }).click();

  await expect(backlog.getByText("QA review")).toBeVisible();

  await backlog.getByLabel("Delete QA review").click();
  await expect(backlog.getByText("QA review")).toHaveCount(0);

  const card = page.getByTestId("card-card-1");
  const launch = page.getByTestId("column-body-col-launch");
  const cardBox = await card.boundingBox();
  const launchBox = await launch.boundingBox();

  if (!cardBox || !launchBox) {
    throw new Error("Unable to read drag/drop target bounds.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    launchBox.x + launchBox.width / 2,
    launchBox.y + 24,
    { steps: 12 }
  );
  await page.mouse.up();

  await expect(launch.getByText("Customer research sprint")).toBeVisible();
});
