/**
 * Browser API compatibility layer for Chrome and Firefox
 *
 * Firefox supports `chrome.*` namespace for compatibility, but also
 * provides `browser.*` with native Promise support. This module
 * normalizes access so we use the best available API.
 *
 * Usage: import { browserAPI } from './utils/browser-api';
 *        browserAPI.storage.local.get(...)
 *        browserAPI.runtime.sendMessage(...)
 */

// Detect the runtime environment
declare const browser: typeof chrome | undefined;

/**
 * Returns the best available browser extension API.
 * Prefers `browser` (Firefox native promises) over `chrome` (callbacks/MV3 promises).
 */
export const browserAPI: typeof chrome =
  typeof browser !== 'undefined' ? (browser as typeof chrome) : chrome;

/**
 * Returns true if running in Firefox
 */
export function isFirefox(): boolean {
  return typeof browser !== 'undefined' && /Firefox/.test(navigator.userAgent);
}

/**
 * Returns true if running in Chrome/Chromium
 */
export function isChrome(): boolean {
  return !isFirefox();
}

/**
 * Get the extension URL for a given path.
 * Works in both Chrome and Firefox.
 */
export function getExtensionURL(path: string): string {
  return browserAPI.runtime.getURL(path);
}
