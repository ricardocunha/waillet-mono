import { test, expect } from './fixtures/extension';
import { TEST_PASSWORD, TEST_MNEMONIC } from './fixtures/helpers';

test.describe('Network Switching', () => {
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

  test('should show ETH token on Ethereum network', async ({ extensionPage }) => {
    // On Ethereum, should show ETH token
    await expect(extensionPage.locator('text=ETH').first()).toBeVisible({ timeout: 5000 });
    // And USDT/USDC
    await expect(extensionPage.locator('text=USDT')).toBeVisible();
    await expect(extensionPage.locator('text=USDC')).toBeVisible();
  });

  test('should show BNB token when switching to BNB Chain', async ({ extensionPage }) => {
    // Switch to BNB Chain
    const networkButton = extensionPage.locator('button:has(svg)').filter({ hasText: /Ethereum|Sepolia|Base|BNB/ }).first();
    await networkButton.click();
    await extensionPage.locator('.bg-slate-800 button').filter({ hasText: 'BNB Chain' }).click();

    // Wait for network switch
    await extensionPage.waitForTimeout(1000);

    // On BNB, should show BNB token (not ETH)
    await expect(extensionPage.locator('text=BNB').first()).toBeVisible({ timeout: 5000 });
  });

  test('should show correct tokens when switching networks back and forth', async ({ extensionPage }) => {
    // Start on Ethereum - verify ETH token is visible
    await expect(extensionPage.locator('text=ETH').first()).toBeVisible({ timeout: 5000 });

    // Switch to BNB Chain
    let networkButton = extensionPage.locator('button:has(svg)').filter({ hasText: /Ethereum|Sepolia|Base|BNB/ }).first();
    await networkButton.click();
    await extensionPage.locator('.bg-slate-800 button').filter({ hasText: 'BNB Chain' }).click();
    await extensionPage.waitForTimeout(1000);

    // Verify BNB token is visible
    await expect(extensionPage.locator('text=BNB').first()).toBeVisible({ timeout: 5000 });

    // Switch back to Ethereum
    networkButton = extensionPage.locator('button:has(svg)').filter({ hasText: /Ethereum|Sepolia|Base|BNB/ }).first();
    await networkButton.click();
    await extensionPage.locator('.bg-slate-800 button').filter({ hasText: /^Ethereum$/ }).click();
    await extensionPage.waitForTimeout(1000);

    // Verify ETH token is visible again (not BNB)
    await expect(extensionPage.locator('text=ETH').first()).toBeVisible({ timeout: 5000 });
    // BNB should NOT be visible on Ethereum network
    const bnbToken = extensionPage.locator('.bg-slate-800:has-text("BNB")');
    await expect(bnbToken).not.toBeVisible();
  });

  test('should switch to Sepolia testnet and show ETH', async ({ extensionPage }) => {
    // Switch to Sepolia
    const networkButton = extensionPage.locator('button:has(svg)').filter({ hasText: /Ethereum|Sepolia|Base|BNB/ }).first();
    await networkButton.click();
    await extensionPage.locator('.bg-slate-800 button').filter({ hasText: /^Sepolia$/ }).click();
    await extensionPage.waitForTimeout(1000);

    // Should show ETH on Sepolia (same native token)
    await expect(extensionPage.locator('text=ETH').first()).toBeVisible({ timeout: 5000 });
    // Network button should show Sepolia
    await expect(extensionPage.locator('button').filter({ hasText: 'Sepolia' }).first()).toBeVisible();
  });

  test('should switch to Base and show ETH', async ({ extensionPage }) => {
    // Switch to Base
    const networkButton = extensionPage.locator('button:has(svg)').filter({ hasText: /Ethereum|Sepolia|Base|BNB/ }).first();
    await networkButton.click();
    await extensionPage.locator('.bg-slate-800 button').filter({ hasText: /^Base$/ }).click();
    await extensionPage.waitForTimeout(1000);

    // Should show ETH on Base
    await expect(extensionPage.locator('text=ETH').first()).toBeVisible({ timeout: 5000 });
    // Network button should show Base
    await expect(extensionPage.locator('button').filter({ hasText: 'Base' }).first()).toBeVisible();
  });

  test('should maintain network selection after page reload', async ({ extensionPage }) => {
    // Switch to BNB
    let networkButton = extensionPage.locator('button:has(svg)').filter({ hasText: /Ethereum|Sepolia|Base|BNB/ }).first();
    await networkButton.click();
    await extensionPage.locator('.bg-slate-800 button').filter({ hasText: 'BNB Chain' }).click();
    await extensionPage.waitForTimeout(500);

    // Reload the page
    await extensionPage.reload();
    await expect(extensionPage.locator('text=Total Balance')).toBeVisible({ timeout: 10000 });

    // Should still be on BNB Chain
    await expect(extensionPage.locator('button').filter({ hasText: 'BNB' }).first()).toBeVisible({ timeout: 5000 });
    await expect(extensionPage.locator('text=BNB').first()).toBeVisible({ timeout: 5000 });
  });
});
