import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('has title and dummy data', async ({ page }) => {
  await expect(page.locator('h1.board-title')).toHaveText('My Project Board');
  
  // Check for some initial cards
  await expect(page.getByText('Setup project')).toBeVisible();
  await expect(page.getByText('Design UI')).toBeVisible();
});

test('can add a new card', async ({ page }) => {
  // Click add card in the first column (col-1)
  const firstColumn = page.locator('.column').first();
  await firstColumn.getByRole('button', { name: /Add Card/i }).click();
  
  // Fill the modal
  await page.locator('input[required]').fill('New Test Task');
  await page.locator('textarea[required]').fill('This is a test task detail');
  
  // Submit
  await page.getByRole('button', { name: /Create Card/i }).click();
  
  // Verify card exists
  await expect(page.getByText('New Test Task')).toBeVisible();
  await expect(page.getByText('This is a test task detail')).toBeVisible();
});

test('can delete a card', async ({ page }) => {
  const card = page.locator('.card').filter({ hasText: 'Setup project' });
  
  // Hover to show delete button
  await card.hover();
  
  const deleteBtn = card.locator('.delete-card-btn');
  await deleteBtn.click();
  
  // Verify card is gone
  await expect(page.getByText('Setup project')).not.toBeVisible();
});

test('can rename a column', async ({ page }) => {
  const firstColumn = page.locator('.column').first();
  const titleInput = firstColumn.locator('.column-title');
  
  await titleInput.fill('New Column Name');
  await titleInput.press('Enter');
  
  await expect(titleInput).toHaveValue('New Column Name');
});

test('can drag and drop a card', async ({ page }) => {
  const sourceCard = page.locator('.card').filter({ hasText: 'Setup project' });
  // Find column by checking the input value
  const targetColumn = page.locator('.column').filter({ has: page.locator('input').and(page.locator('[value="To Do"]')) });
  const cardsInTarget = targetColumn.locator('.card');
  
  const initialCount = await cardsInTarget.count();
  
  // Simplest drag and drop
  await sourceCard.dragTo(targetColumn.locator('.cards-container'));
  
  // Verify it moved
  await expect(cardsInTarget).toHaveCount(initialCount + 1);
  await expect(targetColumn.getByText('Setup project')).toBeVisible();
});
