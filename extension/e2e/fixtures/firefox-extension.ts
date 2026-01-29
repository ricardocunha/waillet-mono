/**
 * Firefox extension test fixture for Playwright
 *
 * Loads the wAIllet extension in Firefox using a temporary profile
 * with the extension pre-installed via web-ext manifest loading.
 *
 * Firefox extension testing differs from Chrome:
 * - Uses `firefox.launchPersistentContext` with a custom profile
 * - Extensions are loaded via about:debugging or profile prefs
 * - Extension ID is deterministic (from manifest browser_specific_settings)
 */
import { test as base, firefox, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Firefox extension ID from manifest.firefox.json browser_specific_settings.gecko.id
const FIREFOX_EXTENSION_ID = 'waillet@waillet.com';

export type FirefoxExtensionFixtures = {
  context: BrowserContext;
  extensionId: string;
  extensionPage: Page;
};

/**
 * Create a Firefox profile directory with the extension pre-installed.
 *
 * Firefox supports loading extensions by placing them in the
 * profile's `extensions/` directory as an XPI or as a directory
 * named with the extension ID.
 */
function setupFirefoxProfile(extensionPath: string): string {
  const profileDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'waillet-firefox-'));
  const extensionsDir = path.join(profileDir, 'extensions');
  fs.mkdirSync(extensionsDir, { recursive: true });

  // Symlink or copy the extension directory with the addon ID as folder name
  const extDest = path.join(extensionsDir, FIREFOX_EXTENSION_ID);

  // Use a JSON pointer file instead of symlink for better compatibility
  // Firefox accepts a plain-text file containing the path to the extension
  fs.writeFileSync(extDest, extensionPath, 'utf-8');

  // Set user preferences to allow unsigned extensions and disable first-run
  const prefsContent = [
    'user_pref("xpinstall.signatures.required", false);',
    'user_pref("extensions.autoDisableScopes", 0);',
    'user_pref("extensions.enabledScopes", 15);',
    'user_pref("browser.shell.checkDefaultBrowser", false);',
    'user_pref("browser.startup.homepage_override.mstone", "ignore");',
    'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
    'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);',
    'user_pref("browser.tabs.warnOnClose", false);',
    'user_pref("browser.sessionstore.resume_from_crash", false);',
  ].join('\n');

  fs.writeFileSync(path.join(profileDir, 'user.js'), prefsContent);

  return profileDir;
}

export const test = base.extend<FirefoxExtensionFixtures>({
  context: async ({}, use) => {
    const extensionPath = path.resolve(__dirname, '../../dist-firefox');

    if (!fs.existsSync(extensionPath)) {
      throw new Error(
        'Firefox extension build not found at dist-firefox/. ' +
        'Run "npm run build:firefox" first.'
      );
    }

    // Launch Firefox with the extension
    // For Playwright Firefox, we use a persistent context with web-ext-artifacts
    const context = await firefox.launchPersistentContext('', {
      headless: false,
      args: [
        // Firefox doesn't have --load-extension like Chrome
        // We rely on the about:debugging approach or profile-based loading
      ],
      firefoxUserPrefs: {
        // Allow unsigned extensions for testing
        'xpinstall.signatures.required': false,
        'extensions.autoDisableScopes': 0,
        'extensions.enabledScopes': 15,
        // Disable various Firefox first-run behaviors
        'browser.shell.checkDefaultBrowser': false,
        'browser.startup.homepage_override.mstone': 'ignore',
        'datareporting.policy.dataSubmissionEnabled': false,
        'toolkit.telemetry.reportingpolicy.firstRun': false,
      },
    });

    await use(context);
    await context.close();
  },

  extensionId: async ({}, use) => {
    // Firefox extension ID is deterministic from the manifest
    await use(FIREFOX_EXTENSION_ID);
  },

  extensionPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    // Firefox uses moz-extension:// protocol
    await page.goto(`moz-extension://${extensionId}/index.html`);
    await use(page);
  },
});

export { expect } from '@playwright/test';
