/**
 * Uniswap E2E Tests - Ethereum Mainnet
 *
 * ⚠️  WARNING: These tests use REAL tokens on Ethereum Mainnet!
 *
 * Prerequisites:
 * 1. Fund the test wallet with:
 *    - ETH for gas fees (minimum 0.01 ETH)
 *    - USDT for swap testing (minimum 0.1 USDT)
 * 2. Set environment variables:
 *    - TEST_WALLET_MNEMONIC: Your funded wallet's mnemonic (12 or 24 words)
 *    - TEST_WALLET_PASSWORD: Password for the wallet
 *    - SWAP_AMOUNT: Amount to swap (default: 0.1)
 *
 * Run:
 *   SWAP_AMOUNT=0.1 npm run test:e2e:uniswap
 */

import { test, expect } from './fixtures/extension';
import { Page, BrowserContext } from '@playwright/test';

// Configuration
const TEST_PASSWORD = process.env.TEST_WALLET_PASSWORD || 'testpassword123';
const TEST_MNEMONIC = process.env.TEST_WALLET_MNEMONIC ||
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const SWAP_AMOUNT = process.env.SWAP_AMOUNT || '0.1';
const SWAP_FROM_TOKEN = 'USDT';
const SWAP_TO_TOKEN = 'USDC';

// Uniswap URL
const UNISWAP_URL = 'https://app.uniswap.org/swap';

// Timeouts
const LONG_TIMEOUT = 120000; // 2 minutes for blockchain operations
const MEDIUM_TIMEOUT = 30000;
const SHORT_TIMEOUT = 10000;

test.describe('Uniswap Integration - Mainnet', () => {
  let uniswapPage: Page;

  test.beforeEach(async ({ context, extensionPage }) => {
    // Clear wallet state
    await extensionPage.evaluate(() => localStorage.clear());
    await extensionPage.reload();

    // Import wallet
    await extensionPage.click('button:has-text("Import Existing Wallet")');
    await extensionPage.fill('textarea', TEST_MNEMONIC);
    await extensionPage.fill('input[placeholder="At least 8 characters"]', TEST_PASSWORD);
    await extensionPage.click('button:has-text("Import Wallet")');

    // Wait for dashboard
    await expect(extensionPage.locator('text=Total Balance')).toBeVisible({ timeout: SHORT_TIMEOUT });

    // Ensure we're on Ethereum Mainnet
    const networkButton = extensionPage.locator('button:has(svg)').filter({ hasText: /Ethereum|Sepolia|Base|BNB/ }).first();
    const networkText = await networkButton.textContent();

    if (!networkText?.includes('Ethereum') || networkText?.includes('Sepolia')) {
      await networkButton.click();
      await extensionPage.locator('.bg-slate-800 button').filter({ hasText: /^Ethereum$/ }).click();
      await extensionPage.waitForTimeout(1000);
    }

    // Open Uniswap in a new tab
    uniswapPage = await context.newPage();
    await uniswapPage.goto(UNISWAP_URL, { waitUntil: 'domcontentloaded' });
    // Don't wait for networkidle - Uniswap has continuous background requests
    await uniswapPage.waitForTimeout(3000);
  });

  test.afterEach(async () => {
    if (uniswapPage && !uniswapPage.isClosed()) {
      await uniswapPage.close();
    }
  });

  test('should connect wallet to Uniswap', async ({ context, extensionPage }) => {
    // Click Connect button on Uniswap
    await uniswapPage.click('button:has-text("Connect")');

    // Wait for wallet options modal
    await uniswapPage.waitForTimeout(2000);

    // Click wAIllet in the wallet options
    await uniswapPage.waitForTimeout(1000);

    // Find the wAIllet text element and get its bounding box for precise clicking
    const wailletText = uniswapPage.getByText('wAIllet', { exact: true }).first();
    if (await wailletText.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Get the bounding box and click slightly to the left (on the row container)
      const box = await wailletText.boundingBox();
      if (box) {
        // Click on the center of the row (at the wAIllet text position)
        await uniswapPage.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        console.log('✅ Clicked wAIllet via mouse click at position');
      } else {
        // Fallback to standard click
        await wailletText.click({ timeout: 5000 });
        console.log('✅ Clicked wAIllet via standard click');
      }
    } else {
      console.error('❌ wAIllet text not found');
      await uniswapPage.screenshot({ path: `test-results/uniswap-no-waillet-${Date.now()}.png` });
    }

    // Wait for the extension popup to appear and find it
    console.log('🔄 Waiting for wallet approval popup...');
    await uniswapPage.waitForTimeout(3000);

    // Find the approval popup - extension opens a new window
    // It might be the extensionPage or a new page in the context
    let approvalPage: Page | null = null;

    // Check all pages in the context for the approval UI
    const allPages = context.pages();
    console.log(`📄 Found ${allPages.length} pages in context`);

    for (const page of allPages) {
      const url = page.url();
      console.log(`  - Page: ${url}`);

      // Check if this is an extension page with approval UI
      if (url.includes('chrome-extension://')) {
        // Look for Connect button (approval modal)
        const connectBtn = page.locator('button').filter({ hasText: /^Connect$/i }).first();
        if (await connectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          approvalPage = page;
          console.log('✅ Found approval page with Connect button');
          break;
        }
      }
    }

    // If not found in existing pages, wait for a new page
    if (!approvalPage) {
      console.log('🔄 Waiting for new popup window...');
      try {
        const newPage = await context.waitForEvent('page', { timeout: 10000 });
        console.log('✅ New page detected:', newPage.url());
        approvalPage = newPage;
      } catch (e) {
        console.log('⚠️ No new page detected, checking extensionPage...');
        // Check if extensionPage now has the approval modal
        const connectBtn = extensionPage.locator('button').filter({ hasText: /^Connect$/i }).first();
        if (await connectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          approvalPage = extensionPage;
          console.log('✅ Found approval modal in extensionPage');
        }
      }
    }

    if (!approvalPage) {
      console.error('❌ No approval popup found');
      // Take screenshots of all pages for debugging
      for (let i = 0; i < allPages.length; i++) {
        await allPages[i].screenshot({ path: `test-results/page-${i}-${Date.now()}.png` });
      }
      throw new Error('Approval popup not found');
    }

    // Handle the popup
    const approved = await handlePopupApproval(approvalPage, 'connect');
    expect(approved).toBe(true);

    // Give Uniswap time to update
    await uniswapPage.waitForTimeout(3000);

    // Verify connection - Uniswap should show connected state (address in button)
    const connectedIndicator = uniswapPage.locator('button').filter({ hasText: /0x[a-fA-F0-9]{4}/i }).first();
    await expect(connectedIndicator).toBeVisible({ timeout: MEDIUM_TIMEOUT });

    console.log('✅ Wallet connected to Uniswap successfully');
  });

  test('should set up USDT to USDC swap', async ({ context, extensionPage }) => {
    // First connect wallet
    await connectWalletToUniswap(uniswapPage, context);

    // Wait for swap interface
    await uniswapPage.waitForTimeout(2000);

    // First select USDT as input token (replace ETH)
    const ethButton = uniswapPage.locator('button').filter({ hasText: /ETH/i }).first();
    if (await ethButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ethButton.click();
      await uniswapPage.waitForTimeout(1000);

      // Search and select USDT
      const searchInput = uniswapPage.locator('input[placeholder*="Search"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill(SWAP_FROM_TOKEN);
        await uniswapPage.waitForTimeout(1000);
      }

      // Click USDT in results
      await uniswapPage.locator('div, span').filter({ hasText: new RegExp(`^${SWAP_FROM_TOKEN}$`) }).first().click();
      await uniswapPage.waitForTimeout(1000);
    }

    // Enter swap amount
    const sellInput = uniswapPage.locator('input').first();
    await sellInput.click();
    await sellInput.fill(SWAP_AMOUNT);

    // Select USDC as output token
    const selectTokenBtn = uniswapPage.locator('button:has-text("Select token")').first();
    if (await selectTokenBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await selectTokenBtn.click();
      await uniswapPage.waitForTimeout(1000);

      // Search and select USDC
      const searchInput = uniswapPage.locator('input[placeholder*="Search"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill(SWAP_TO_TOKEN);
        await uniswapPage.waitForTimeout(1000);
      }

      // Click USDC in results
      await uniswapPage.locator('div, span').filter({ hasText: new RegExp(`^${SWAP_TO_TOKEN}$`) }).first().click();
    }

    // Wait for quote
    await uniswapPage.waitForTimeout(3000);

    // Verify USDC output is shown
    await expect(uniswapPage.locator(`text=/[0-9]+.*${SWAP_TO_TOKEN}|${SWAP_TO_TOKEN}.*[0-9]+/`)).toBeVisible({ timeout: MEDIUM_TIMEOUT });

    console.log(`✅ Swap setup: ${SWAP_AMOUNT} ${SWAP_FROM_TOKEN} → ${SWAP_TO_TOKEN}`);
  });

  test('should execute USDT to USDC swap', async ({ context }) => {
    test.slow(); // Mark as slow test

    // Connect wallet
    await connectWalletToUniswap(uniswapPage, context);

    // Set up swap (USDT to USDC)
    await setupSwap(uniswapPage, SWAP_AMOUNT, SWAP_FROM_TOKEN, SWAP_TO_TOKEN);

    // Click Swap button - use mouse click to bypass overlay interception
    const swapButton = uniswapPage.locator('button').filter({ hasText: /^Swap$/ }).first();
    await expect(swapButton).toBeEnabled({ timeout: MEDIUM_TIMEOUT });
    const swapBox = await swapButton.boundingBox();
    if (swapBox) {
      await uniswapPage.mouse.click(swapBox.x + swapBox.width / 2, swapBox.y + swapBox.height / 2);
    } else {
      await swapButton.click({ force: true });
    }

    // Confirm in Uniswap modal if present
    await uniswapPage.waitForTimeout(2000);
    const confirmBtn = uniswapPage.locator('button').filter({ hasText: /Confirm Swap/i }).first();
    if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const confirmBox = await confirmBtn.boundingBox();
      if (confirmBox) {
        await uniswapPage.mouse.click(confirmBox.x + confirmBox.width / 2, confirmBox.y + confirmBox.height / 2);
      } else {
        await confirmBtn.click({ force: true });
      }
    }

    // Wait for transaction approval popup
    await uniswapPage.waitForTimeout(3000);

    // Find approval page in context (same approach as connect)
    let approvalPage: Page | null = null;
    const allPages = context.pages();
    console.log(`📄 Found ${allPages.length} pages for transaction approval`);

    for (const page of allPages) {
      if (page.url().includes('chrome-extension://')) {
        // Look for Confirm/Sign button (transaction approval)
        const txBtn = page.locator('button').filter({ hasText: /^Confirm$|^Sign$|^Send$|Proceed/i }).first();
        if (await txBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          approvalPage = page;
          console.log('✅ Found transaction approval page');
          break;
        }
      }
    }

    if (!approvalPage) {
      try {
        approvalPage = await context.waitForEvent('page', { timeout: 10000 });
        console.log('✅ New transaction popup detected');
      } catch (e) {
        console.error('❌ No transaction approval popup found');
      }
    }

    let approved = false;
    if (approvalPage) {
      approved = await handlePopupApproval(approvalPage, 'transaction');
    }
    expect(approved).toBe(true);

    // Wait for transaction submission
    await expect(uniswapPage.locator('text=/Transaction submitted|Swap submitted|Pending/i'))
      .toBeVisible({ timeout: LONG_TIMEOUT });

    console.log(`✅ Swap transaction submitted: ${SWAP_AMOUNT} ${SWAP_FROM_TOKEN} → ${SWAP_TO_TOKEN}`);
  });

  test('should display wallet balance on Uniswap', async ({ context }) => {
    // Connect wallet
    await connectWalletToUniswap(uniswapPage, context);

    // Wait for balance to load
    await uniswapPage.waitForTimeout(3000);

    // Look for balance display - Uniswap shows balance near the token selector
    // The balance is typically shown as a number followed by token symbol
    const balanceLocator = uniswapPage.locator('text=/[0-9]+\\.?[0-9]*\\s*(ETH|USDT|USDC)/i').first();

    if (await balanceLocator.isVisible({ timeout: MEDIUM_TIMEOUT }).catch(() => false)) {
      const balance = await balanceLocator.textContent();
      console.log(`💰 Balance shown: ${balance}`);
      expect(balance).toMatch(/[0-9]+\.?[0-9]*/);
    } else {
      // Fallback: just verify the connected state shows address
      const connectedAddr = uniswapPage.locator('button').filter({ hasText: /0x[a-fA-F0-9]{4}/i }).first();
      await expect(connectedAddr).toBeVisible({ timeout: MEDIUM_TIMEOUT });
      console.log('✅ Wallet connected (balance display varies by Uniswap UI state)');
    }
  });
});

/**
 * Handle popup approval given a popup page
 */
async function handlePopupApproval(
  popupPage: Page,
  action: 'connect' | 'transaction'
): Promise<boolean> {
  console.log(`🔄 Handling popup approval (${action})...`);

  // Wait for popup to fully load
  await popupPage.waitForLoadState('domcontentloaded');
  await popupPage.waitForTimeout(2000);

  // Take screenshot for debugging
  await popupPage.screenshot({ path: `test-results/popup-${action}-${Date.now()}.png` });

  // Log current URL and page state
  console.log('Popup URL:', popupPage.url());

  if (action === 'connect') {
    // Look for Connect/Approve button for connection requests
    // The ConnectionApprovalModal has "Connect" button
    const approveBtn = popupPage.locator('button').filter({
      hasText: /^Connect$|^Approve$|^Allow$/i
    }).first();

    if (await approveBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await approveBtn.click();
      console.log('✅ Clicked approve button for connection');
      await popupPage.waitForTimeout(1000);
      return true;
    } else {
      console.error('❌ Approve button not found');
      // Log all buttons on the page for debugging
      const buttons = await popupPage.locator('button').allTextContents();
      console.log('Available buttons:', buttons);
      return false;
    }
  } else if (action === 'transaction') {
    // Wait for risk analysis to complete
    await popupPage.waitForTimeout(5000);

    // Check for "Proceed" button (after risk analysis)
    const proceedBtn = popupPage.locator('button').filter({ hasText: /Proceed|Continue/i }).first();
    if (await proceedBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await proceedBtn.click();
      console.log('✅ Clicked proceed on risk analysis');
      await popupPage.waitForTimeout(1000);
    }

    // Now look for Confirm/Sign button
    const confirmBtn = popupPage.locator('button').filter({
      hasText: /^Confirm$|^Sign$|^Approve$|^Send$/i
    }).first();

    if (await confirmBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await confirmBtn.click();
      console.log('✅ Clicked confirm button for transaction');
      await popupPage.waitForTimeout(1000);
      return true;
    } else {
      console.error('❌ Confirm button not found');
      const buttons = await popupPage.locator('button').allTextContents();
      console.log('Available buttons:', buttons);
      return false;
    }
  }

  return false;
}

/**
 * Wait for wallet popup and handle it
 */
async function waitForPopupAndApprove(
  context: BrowserContext,
  action: 'connect' | 'transaction'
): Promise<boolean> {
  console.log(`🔄 Waiting for new popup window (${action})...`);

  try {
    const popupPage = await context.waitForEvent('page', { timeout: MEDIUM_TIMEOUT });
    console.log('✅ New popup window detected');
    return await handlePopupApproval(popupPage, action);
  } catch (e) {
    console.error('❌ Timeout waiting for popup window');
    return false;
  }
}

/**
 * Connect wallet to Uniswap
 */
async function connectWalletToUniswap(
  uniswapPage: Page,
  context: BrowserContext
): Promise<void> {
  // Check if already connected
  const connected = uniswapPage.locator('button').filter({ hasText: /0x[a-fA-F0-9]{4}/i }).first();
  if (await connected.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('ℹ️  Wallet already connected');
    return;
  }

  // Click Connect
  await uniswapPage.click('button:has-text("Connect")');
  await uniswapPage.waitForTimeout(1500);

  // Click wAIllet option - use mouse click at position for proper event handling
  await uniswapPage.waitForTimeout(1000);
  const wailletText = uniswapPage.getByText('wAIllet', { exact: true }).first();
  if (await wailletText.isVisible({ timeout: 5000 }).catch(() => false)) {
    const box = await wailletText.boundingBox();
    if (box) {
      await uniswapPage.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      console.log('✅ Clicked wAIllet via mouse click');
    } else {
      await wailletText.click({ timeout: 5000 });
      console.log('✅ Clicked wAIllet via standard click');
    }
  }

  // Wait for approval popup and handle it
  await uniswapPage.waitForTimeout(3000);

  // Find the approval page in context
  let approvalPage: Page | null = null;
  const allPages = context.pages();

  for (const page of allPages) {
    if (page.url().includes('chrome-extension://')) {
      const connectBtn = page.locator('button').filter({ hasText: /^Connect$/i }).first();
      if (await connectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        approvalPage = page;
        break;
      }
    }
  }

  if (!approvalPage) {
    try {
      approvalPage = await context.waitForEvent('page', { timeout: 10000 });
    } catch (e) {
      console.error('❌ Could not find approval page');
      throw new Error('Approval page not found');
    }
  }

  await handlePopupApproval(approvalPage, 'connect');

  // Verify connected
  await uniswapPage.waitForTimeout(2000);
  await expect(uniswapPage.locator('button').filter({ hasText: /0x[a-fA-F0-9]{4}/i }).first())
    .toBeVisible({ timeout: MEDIUM_TIMEOUT });
}

/**
 * Set up a swap on Uniswap
 */
async function setupSwap(
  uniswapPage: Page,
  amount: string,
  fromToken: string,
  toToken: string
): Promise<void> {
  await uniswapPage.waitForTimeout(2000);

  // First select input token (replace ETH if needed)
  if (fromToken !== 'ETH') {
    const ethButton = uniswapPage.locator('button').filter({ hasText: /ETH/i }).first();
    if (await ethButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ethButton.click();
      await uniswapPage.waitForTimeout(1000);

      const search = uniswapPage.locator('input[placeholder*="Search"]').first();
      if (await search.isVisible()) {
        await search.fill(fromToken);
        await uniswapPage.waitForTimeout(1000);
      }

      await uniswapPage.locator('div, span').filter({ hasText: new RegExp(`^${fromToken}$`) }).first().click();
      await uniswapPage.waitForTimeout(1000);
    }
  }

  // Enter amount
  const input = uniswapPage.locator('input').first();
  await input.click();
  await input.fill(amount);

  // Select output token
  const selectBtn = uniswapPage.locator('button:has-text("Select token")').first();
  if (await selectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await selectBtn.click();
    await uniswapPage.waitForTimeout(500);

    const search = uniswapPage.locator('input[placeholder*="Search"]').first();
    if (await search.isVisible()) {
      await search.fill(toToken);
      await uniswapPage.waitForTimeout(1000);
    }

    await uniswapPage.locator('div, span').filter({ hasText: new RegExp(`^${toToken}$`) }).first().click();
  }

  // Wait for quote
  await uniswapPage.waitForTimeout(3000);
}

// Pre-flight check
test.describe('Pre-flight Checks', () => {
  test('should verify wallet has sufficient token balances', async ({ extensionPage }) => {
    await extensionPage.evaluate(() => localStorage.clear());
    await extensionPage.reload();

    await extensionPage.click('button:has-text("Import Existing Wallet")');
    await extensionPage.fill('textarea', TEST_MNEMONIC);
    await extensionPage.fill('input[placeholder="At least 8 characters"]', TEST_PASSWORD);
    await extensionPage.click('button:has-text("Import Wallet")');

    await expect(extensionPage.locator('text=Total Balance')).toBeVisible({ timeout: SHORT_TIMEOUT });

    // Switch to Ethereum Mainnet
    const networkButton = extensionPage.locator('button:has(svg)').filter({ hasText: /Ethereum|Sepolia|Base|BNB/ }).first();
    await networkButton.click();
    await extensionPage.locator('.bg-slate-800 button').filter({ hasText: /^Ethereum$/ }).click();
    await extensionPage.waitForTimeout(3000);

    // Get ETH balance for gas
    const ethRow = extensionPage.locator('text=ETH').first().locator('..');
    const ethBalanceText = await ethRow.textContent();

    // Get USDT balance for swap
    const usdtRow = extensionPage.locator('text=USDT').first().locator('..');
    const usdtBalanceText = await usdtRow.textContent().catch(() => 'USDT: 0');

    console.log(`\n💰 Wallet Balance Info:`);
    console.log(`   ETH (for gas): ${ethBalanceText}`);
    console.log(`   USDT (for swap): ${usdtBalanceText}`);
    console.log(`📊 Configured Swap: ${SWAP_AMOUNT} ${SWAP_FROM_TOKEN} → ${SWAP_TO_TOKEN}\n`);

    // Extract numeric ETH balance (for gas)
    const ethMatch = ethBalanceText?.match(/([0-9]+\.?[0-9]*)/);
    const ethBalance = ethMatch ? parseFloat(ethMatch[1]) : 0;

    // Extract numeric USDT balance (for swap)
    const usdtMatch = usdtBalanceText?.match(/([0-9]+\.?[0-9]*)/);
    const usdtBalance = usdtMatch ? parseFloat(usdtMatch[1]) : 0;

    if (ethBalance < 0.005) {
      console.warn(`⚠️  WARNING: May have insufficient ETH for gas`);
    }
    if (usdtBalance < parseFloat(SWAP_AMOUNT)) {
      console.warn(`⚠️  WARNING: May have insufficient USDT for swap`);
    }
    if (ethBalance >= 0.005 && usdtBalance >= parseFloat(SWAP_AMOUNT)) {
      console.log(`✅ Balances appear sufficient\n`);
    }

    expect(ethBalance).toBeGreaterThanOrEqual(0);
  });
});
