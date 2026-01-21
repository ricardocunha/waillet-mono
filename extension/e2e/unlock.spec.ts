import { test, expect } from './fixtures/extension';
import { TEST_PASSWORD, TEST_MNEMONIC } from './fixtures/helpers';

test.describe('Unlock Wallet', () => {
  test.beforeEach(async ({ extensionPage }) => {
    // Setup: Import wallet first
    await extensionPage.evaluate((mnemonic) => {
      localStorage.clear();
    }, TEST_MNEMONIC);
    await extensionPage.reload();

    // Import wallet to have something to unlock
    await extensionPage.click('button:has-text("Import Existing Wallet")');
    await extensionPage.fill('textarea', TEST_MNEMONIC);
    await extensionPage.fill('input[placeholder="At least 8 characters"]', TEST_PASSWORD);
    await extensionPage.click('button:has-text("Import Wallet")');
    await expect(extensionPage.locator('text=Total Balance')).toBeVisible({ timeout: 10000 });

    // Clear session to trigger lock
    await extensionPage.evaluate(() => {
      sessionStorage.clear();
      localStorage.removeItem('walletSession');
    });
    await extensionPage.reload();
  });

  test('should show unlock screen when wallet is locked', async ({ extensionPage }) => {
    await expect(extensionPage.locator('text=Enter your password')).toBeVisible();
    await expect(extensionPage.locator('button:has-text("Unlock")')).toBeVisible();
  });

  test('should unlock wallet with correct password', async ({ extensionPage }) => {
    await extensionPage.fill('input[type="password"]', TEST_PASSWORD);
    await extensionPage.click('button:has-text("Unlock")');

    await expect(extensionPage.locator('text=Total Balance')).toBeVisible({ timeout: 10000 });
  });

  test('should show error with incorrect password', async ({ extensionPage }) => {
    await extensionPage.fill('input[type="password"]', 'wrongpassword');
    await extensionPage.click('button:has-text("Unlock")');

    await expect(extensionPage.locator('text=Wrong password')).toBeVisible({ timeout: 5000 });
  });

  test('should disable unlock button when password is empty', async ({ extensionPage }) => {
    const unlockButton = extensionPage.locator('button:has-text("Unlock")');
    await expect(unlockButton).toBeDisabled();
  });
});
