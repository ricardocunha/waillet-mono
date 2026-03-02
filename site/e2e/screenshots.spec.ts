import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const screenshotsDir = path.join(__dirname, '../public/screenshots')

// Ensure screenshots directory exists
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true })
}

// Test credentials (same as extension e2e tests)
const TEST_PASSWORD = 'testpassword123'
const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

// Extension fixture type
type ExtensionFixtures = {
  context: BrowserContext
  extensionId: string
  extensionPage: Page
}

// Helper to clear wallet data
async function clearWalletData(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}

// Helper to import wallet
async function importWallet(page: Page): Promise<void> {
  // Click "Import Existing Wallet"
  await page.click('button:has-text("Import Existing Wallet")')

  // Enter mnemonic and password
  await page.fill('textarea', TEST_MNEMONIC)
  await page.fill('input[placeholder="At least 8 characters"]', TEST_PASSWORD)
  await page.click('button:has-text("Import Wallet")')

  // Wait for dashboard
  await page.waitForSelector('text=Total Balance', { timeout: 15000 })
}

// Create a test fixture that loads the extension
const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const extensionPath = path.join(__dirname, '../../extension/dist')

    if (!fs.existsSync(extensionPath)) {
      console.error('Extension not built. Please run `npm run build` in the extension folder first.')
      throw new Error('Extension not built')
    }

    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    })

    await use(context)
    await context.close()
  },

  extensionId: async ({ context }, use) => {
    let serviceWorker = context.serviceWorkers()[0]
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker')
    }

    const extensionId = serviceWorker.url().split('/')[2]
    await use(extensionId)
  },

  extensionPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/index.html`)
    await use(page)
  },
})

test.describe('Screenshot Capture', () => {
  // Setup wallet before each test
  test.beforeEach(async ({ extensionPage }) => {
    await clearWalletData(extensionPage)
    await extensionPage.reload()
    await extensionPage.waitForLoadState('networkidle')
    await importWallet(extensionPage)
    await extensionPage.waitForTimeout(1500) // Wait for balances to load
  })

  test('capture extension dashboard', async ({ extensionPage }) => {
    await extensionPage.setViewportSize({ width: 506, height: 600 })
    await extensionPage.waitForTimeout(500)

    await extensionPage.screenshot({
      path: path.join(screenshotsDir, 'extension-dashboard.png'),
      fullPage: false,
    })
  })

  test('capture extension with networks dropdown', async ({ extensionPage }) => {
    await extensionPage.setViewportSize({ width: 506, height: 600 })

    // Click on the network selector button
    const networkButton = extensionPage.locator('button:has(svg.lucide-chevron-down)').first()
    if (await networkButton.count() > 0) {
      await networkButton.click()
      await extensionPage.waitForTimeout(300)
    }

    await extensionPage.screenshot({
      path: path.join(screenshotsDir, 'extension-networks.png'),
      fullPage: false,
    })
  })

  test('capture extension AI agent tab', async ({ extensionPage }) => {
    await extensionPage.setViewportSize({ width: 506, height: 600 })

    // Click on the AI Agent tab
    const aiTab = extensionPage.locator('button:has-text("AI Agent")')
    if (await aiTab.count() > 0) {
      await aiTab.click()
      await extensionPage.waitForTimeout(500)
    }

    await extensionPage.screenshot({
      path: path.join(screenshotsDir, 'extension-ai.png'),
      fullPage: false,
    })
  })

  test('capture extension send modal', async ({ extensionPage }) => {
    await extensionPage.setViewportSize({ width: 506, height: 600 })

    // Click on the Send button
    const sendButton = extensionPage.locator('button:has-text("Send")').first()
    if (await sendButton.count() > 0) {
      await sendButton.click()
      await extensionPage.waitForTimeout(500)
    }

    await extensionPage.screenshot({
      path: path.join(screenshotsDir, 'extension-send.png'),
      fullPage: false,
    })
  })

  test('capture extension settings menu', async ({ extensionPage }) => {
    await extensionPage.setViewportSize({ width: 506, height: 600 })

    // Click on the settings menu (3-dot button)
    const settingsButton = extensionPage.locator('button:has(svg.lucide-more-vertical)')
    if (await settingsButton.count() > 0) {
      await settingsButton.click()
      await extensionPage.waitForTimeout(300)
    }

    await extensionPage.screenshot({
      path: path.join(screenshotsDir, 'extension-menu.png'),
      fullPage: false,
    })
  })

  test('capture extension account settings', async ({ extensionPage }) => {
    await extensionPage.setViewportSize({ width: 506, height: 600 })

    // Click on the settings menu (3-dot button)
    const settingsButton = extensionPage.locator('button:has(svg.lucide-more-vertical)')
    if (await settingsButton.count() > 0) {
      await settingsButton.click()
      await extensionPage.waitForTimeout(300)

      // Click on Account Settings option
      const accountSettingsOption = extensionPage.locator('button:has-text("Account Settings")')
      if (await accountSettingsOption.count() > 0) {
        await accountSettingsOption.click()
        await extensionPage.waitForTimeout(500)
      }
    }

    await extensionPage.screenshot({
      path: path.join(screenshotsDir, 'extension-settings.png'),
      fullPage: false,
    })
  })

  test('capture extension favorite modal', async ({ extensionPage }) => {
    await extensionPage.setViewportSize({ width: 506, height: 600 })

    // Click on the Favorite button
    const favoriteButton = extensionPage.locator('button:has-text("Favorite")')
    if (await favoriteButton.count() > 0) {
      await favoriteButton.click()
      await extensionPage.waitForTimeout(500)
    }

    await extensionPage.screenshot({
      path: path.join(screenshotsDir, 'extension-favorite.png'),
      fullPage: false,
    })
  })
})
