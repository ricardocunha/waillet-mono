import { test, expect } from './fixtures/extension';
import { TEST_PASSWORD, TEST_MNEMONIC } from './fixtures/helpers';

test.describe('Account Management', () => {
  test.beforeEach(async ({ extensionPage }) => {
    // Setup: Import wallet
    await extensionPage.evaluate(() => localStorage.clear());
    await extensionPage.reload();

    await extensionPage.click('button:has-text("Import Existing Wallet")');
    await extensionPage.fill('textarea', TEST_MNEMONIC);
    await extensionPage.fill('input[placeholder="At least 8 characters"]', TEST_PASSWORD);
    await extensionPage.click('button:has-text("Import Wallet")');
    await expect(extensionPage.locator('text=Total Balance')).toBeVisible({ timeout: 10000 });
  });

  test('should display account selector', async ({ extensionPage }) => {
    // Account selector should show account name and address
    await expect(extensionPage.locator('text=Account 1')).toBeVisible();
    await expect(extensionPage.locator('text=/0x[a-fA-F0-9]{4}\\.\\.\\.[a-fA-F0-9]{4}/')).toBeVisible();
  });

  test('should open account dropdown', async ({ extensionPage }) => {
    // Click account selector
    await extensionPage.click('text=Account 1');

    // Should show dropdown with Add Account option
    await expect(extensionPage.locator('text=Add Account')).toBeVisible();
  });

  test('should create new account', async ({ extensionPage }) => {
    // Open account dropdown
    await extensionPage.click('text=Account 1');

    // Click Add Account
    await extensionPage.click('text=Add Account');

    // Should show Add Account modal
    await expect(extensionPage.locator('text=Create New Account')).toBeVisible();

    // Click Create New Account
    await extensionPage.click('button:has-text("Create New Account")');

    // Should show success and close
    await expect(extensionPage.locator('text=Account Added')).toBeVisible({ timeout: 5000 });

    // Wait for modal to close
    await extensionPage.waitForTimeout(1500);

    // Should now show Account 2 in dropdown
    await extensionPage.click('text=/Account [12]/');
    await expect(extensionPage.locator('text=Account 2').first()).toBeVisible();
  });

  test('should switch between accounts', async ({ extensionPage }) => {
    // First create a second account
    await extensionPage.click('text=Account 1');
    await extensionPage.click('text=Add Account');
    await extensionPage.click('button:has-text("Create New Account")');
    await expect(extensionPage.locator('text=Account Added')).toBeVisible({ timeout: 5000 });
    await extensionPage.waitForTimeout(1500);

    // Get current address
    const initialAddress = await extensionPage.locator('text=/0x[a-fA-F0-9]{4}\\.\\.\\.[a-fA-F0-9]{4}/').first().textContent();

    // Open dropdown and switch to Account 1
    await extensionPage.click('text=Account 2');
    await extensionPage.click('text=Account 1');

    // Address should change
    const newAddress = await extensionPage.locator('text=/0x[a-fA-F0-9]{4}\\.\\.\\.[a-fA-F0-9]{4}/').first().textContent();
    expect(newAddress).not.toBe(initialAddress);
  });

  test('should copy account address', async ({ extensionPage }) => {
    // Open account dropdown
    await extensionPage.click('text=Account 1');

    // Click copy button (first one in the list)
    await extensionPage.click('button[title="Copy address"]');

    // Should show checkmark indicating copied
    await expect(extensionPage.locator('svg.text-green-400')).toBeVisible({ timeout: 2000 });
  });
});
