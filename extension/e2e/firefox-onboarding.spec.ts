/**
 * Firefox E2E tests for the onboarding flow.
 *
 * These tests verify that the wallet creation and import flows
 * work correctly in Firefox. They mirror the Chrome onboarding tests
 * but use the Firefox extension fixture.
 */
import { test, expect } from './fixtures/firefox-extension';
import { TEST_PASSWORD, TEST_MNEMONIC, clearWalletData } from './fixtures/helpers';

test.describe('Firefox: Onboarding', () => {
  test.beforeEach(async ({ extensionPage }) => {
    await clearWalletData(extensionPage);
    await extensionPage.reload();
  });

  test('should show welcome screen for new users', async ({ extensionPage }) => {
    await expect(extensionPage.locator('text=Create New Wallet')).toBeVisible();
    await expect(extensionPage.locator('text=Import Existing Wallet')).toBeVisible();
  });

  test('should create a new wallet', async ({ extensionPage }) => {
    // Click create wallet
    await extensionPage.click('button:has-text("Create New Wallet")');

    // Enter password
    await extensionPage.fill('input[placeholder="At least 8 characters"]', TEST_PASSWORD);
    await extensionPage.fill('input[placeholder="Enter password again"]', TEST_PASSWORD);
    await extensionPage.click('button:has-text("Create Wallet")');

    // Should show mnemonic backup screen
    await expect(extensionPage.locator('text=Save Your Recovery Phrase')).toBeVisible({ timeout: 5000 });

    // Confirm backup
    await extensionPage.click('button:has-text("I\'ve Saved It")');

    // Should reach dashboard
    await expect(extensionPage.locator('text=Total Balance')).toBeVisible({ timeout: 10000 });
  });

  test('should import wallet with mnemonic', async ({ extensionPage }) => {
    // Click import wallet
    await extensionPage.click('button:has-text("Import Existing Wallet")');

    // Enter mnemonic and password
    await extensionPage.fill('textarea', TEST_MNEMONIC);
    await extensionPage.fill('input[placeholder="At least 8 characters"]', TEST_PASSWORD);
    await extensionPage.click('button:has-text("Import Wallet")');

    // Should reach dashboard
    await expect(extensionPage.locator('text=Total Balance')).toBeVisible({ timeout: 10000 });
  });
});
