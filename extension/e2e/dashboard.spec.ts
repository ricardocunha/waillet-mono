import { test, expect } from './fixtures/extension';
import { TEST_PASSWORD, TEST_MNEMONIC } from './fixtures/helpers';

test.describe('Dashboard', () => {
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

  test('should display wallet balance', async ({ extensionPage }) => {
    await expect(extensionPage.locator('text=Total Balance')).toBeVisible();
    await expect(extensionPage.locator('text=/\\$[0-9]+/').first()).toBeVisible();
  });

  test('should display token list', async ({ extensionPage }) => {
    await expect(extensionPage.locator('text=Tokens')).toBeVisible();
    await expect(extensionPage.locator('text=ETH').first()).toBeVisible();
  });

  test('should show network selector', async ({ extensionPage }) => {
    // Click network dropdown - the button in the header showing current network
    const networkButton = extensionPage.locator('button:has(svg)').filter({ hasText: /Ethereum|Sepolia|Base|BNB/ }).first();
    await networkButton.click();

    // Should show mainnet and testnet options
    await expect(extensionPage.locator('text=Testnets')).toBeVisible();
    await expect(extensionPage.locator('text=Ethereum').first()).toBeVisible();
    await expect(extensionPage.locator('text=BNB Chain')).toBeVisible();
    await expect(extensionPage.locator('text=Base').first()).toBeVisible();
    await expect(extensionPage.locator('text=Sepolia').first()).toBeVisible();
  });

  test('should switch networks', async ({ extensionPage }) => {
    // Open network dropdown
    const networkButton = extensionPage.locator('button:has(svg)').filter({ hasText: /Ethereum|Sepolia|Base|BNB/ }).first();
    await networkButton.click();

    // Select Sepolia from dropdown (use exact text match to avoid matching "Base Sepolia")
    await extensionPage.locator('.bg-slate-800 button').filter({ hasText: /^Sepolia$/ }).click();

    // Verify network changed - the main button should now show Sepolia
    await expect(extensionPage.locator('button').filter({ hasText: 'Sepolia' }).first()).toBeVisible();
  });

  test('should show send button', async ({ extensionPage }) => {
    await expect(extensionPage.locator('button:has-text("Send")')).toBeVisible();
  });

  test('should show favorite button', async ({ extensionPage }) => {
    await expect(extensionPage.locator('button:has-text("Favorite")')).toBeVisible();
  });

  test('should refresh balances', async ({ extensionPage }) => {
    // Click refresh button
    await extensionPage.click('button[title="Refresh balances"]');

    // Balances should still be visible after refresh
    await expect(extensionPage.locator('text=ETH').first()).toBeVisible({ timeout: 10000 });
  });
});
