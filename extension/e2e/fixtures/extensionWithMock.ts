import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupMockRpcContext } from './mockRpc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extension fixture type with mock
export type ExtensionFixturesWithMock = {
  context: BrowserContext;
  extensionId: string;
  extensionPage: Page;
};

// Create a test fixture that loads the extension WITH mock RPC
export const test = base.extend<ExtensionFixturesWithMock>({
  // Browser context with extension loaded and mock RPC
  context: async ({}, use) => {
    const extensionPath = path.join(__dirname, '../../dist');

    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    // Setup mock RPC at context level BEFORE any pages are created
    await setupMockRpcContext(context);

    await use(context);
    await context.close();
  },

  // Get the extension ID from the loaded extension
  extensionId: async ({ context }, use) => {
    // Wait for service worker to be ready
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }

    // Extract extension ID from service worker URL
    const extensionId = serviceWorker.url().split('/')[2];
    await use(extensionId);
  },

  // Pre-opened extension page
  extensionPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await use(page);
  },
});

export { expect } from '@playwright/test';
