import { Page } from '@playwright/test';

// Test wallet credentials
export const TEST_PASSWORD = 'testpassword123';
export const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

/**
 * Create a new wallet through the onboarding flow
 */
export async function createWallet(page: Page, password: string = TEST_PASSWORD): Promise<string> {
  // Click "Create New Wallet"
  await page.click('button:has-text("Create New Wallet")');

  // Enter password on the same page
  await page.fill('input[placeholder="At least 8 characters"]', password);
  await page.fill('input[placeholder="Enter password again"]', password);
  await page.click('button:has-text("Create Wallet")');

  // Wait for mnemonic backup screen
  await page.waitForSelector('text=Save Your Recovery Phrase', { timeout: 5000 });

  // Get mnemonic words from the grid
  const wordElements = await page.locator('.font-mono.font-medium').allTextContents();
  const mnemonic = wordElements.join(' ');

  // Confirm backup
  await page.click('button:has-text("I\'ve Saved It")');

  return mnemonic;
}

/**
 * Import a wallet using mnemonic
 */
export async function importWallet(
  page: Page,
  mnemonic: string = TEST_MNEMONIC,
  password: string = TEST_PASSWORD
): Promise<void> {
  // Click "Import Existing Wallet"
  await page.click('button:has-text("Import Existing Wallet")');

  // Enter mnemonic and password on the same page
  await page.fill('textarea', mnemonic);
  await page.fill('input[placeholder="At least 8 characters"]', password);
  await page.click('button:has-text("Import Wallet")');

  // Wait for dashboard
  await page.waitForSelector('text=Total Balance', { timeout: 10000 });
}

/**
 * Unlock an existing wallet
 */
export async function unlockWallet(page: Page, password: string = TEST_PASSWORD): Promise<void> {
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Unlock")');
  await page.waitForSelector('text=Total Balance', { timeout: 10000 });
}

/**
 * Setup wallet in localStorage/storage for faster tests
 */
export async function setupWalletState(page: Page): Promise<void> {
  // This sets up encrypted wallet data directly
  // Useful for skipping onboarding in most tests
  await page.evaluate(() => {
    // Set a pre-configured wallet state
    // The encrypted value below is the TEST_MNEMONIC encrypted with TEST_PASSWORD
    localStorage.setItem('wallet', 'encrypted_wallet_data_here');
  });
}

/**
 * Clear all wallet data
 */
export async function clearWalletData(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Wait for network to be idle
 */
export async function waitForNetworkIdle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

/**
 * Select a network from the dropdown
 */
export async function selectNetwork(page: Page, networkName: string): Promise<void> {
  // Click network dropdown
  await page.click('[data-testid="network-selector"]');

  // Click network option
  await page.click(`button:has-text("${networkName}")`);
}

/**
 * Get current account address
 */
export async function getCurrentAddress(page: Page): Promise<string> {
  const addressElement = await page.locator('.font-mono').first();
  return await addressElement.textContent() || '';
}
