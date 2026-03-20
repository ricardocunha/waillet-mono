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

type ChromeAPI = typeof chrome;
type Listener<T extends (...args: any[]) => void> = {
  addListener: (callback: T) => void;
  removeListener: (callback: T) => void;
  hasListener: (callback: T) => boolean;
};

type ExtensionGlobals = {
  browser?: ChromeAPI;
  chrome?: ChromeAPI;
};

const extensionGlobals = globalThis as unknown as ExtensionGlobals;

function createListener<T extends (...args: any[]) => void>(): Listener<T> {
  const callbacks = new Set<T>();

  return {
    addListener: (callback: T) => callbacks.add(callback),
    removeListener: (callback: T) => callbacks.delete(callback),
    hasListener: (callback: T) => callbacks.has(callback),
  };
}

function createFallbackChromeAPI(): ChromeAPI {
  const storageData: Record<string, unknown> = {};
  const onMessage = createListener<any>();
  const onInstalled = createListener<any>();
  const onRemoved = createListener<any>();
  const onChanged = createListener<any>();

  const local = {
    async get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>> {
      if (keys == null) {
        return { ...storageData };
      }

      if (typeof keys === 'string') {
        return { [keys]: storageData[keys] };
      }

      if (Array.isArray(keys)) {
        const result: Record<string, unknown> = {};
        keys.forEach((key) => {
          result[key] = storageData[key];
        });
        return result;
      }

      const result: Record<string, unknown> = {};
      Object.keys(keys).forEach((key) => {
        result[key] = Object.prototype.hasOwnProperty.call(storageData, key)
          ? storageData[key]
          : keys[key];
      });
      return result;
    },

    async set(items: Record<string, unknown>): Promise<void> {
      Object.assign(storageData, items);
    },

    async remove(keys: string | string[]): Promise<void> {
      const list = Array.isArray(keys) ? keys : [keys];
      list.forEach((key) => delete storageData[key]);
    },

    async clear(): Promise<void> {
      Object.keys(storageData).forEach((key) => delete storageData[key]);
    },
  };

  return {
    runtime: {
      getURL: (path: string) => path,
      sendMessage: async () => undefined,
      onMessage,
      onInstalled,
    },
    storage: {
      local,
      onChanged,
    },
    tabs: {
      sendMessage: async () => undefined,
    },
    windows: {
      onRemoved,
      get: async () => undefined,
      update: async () => undefined,
      create: async () => ({ id: 1 } as chrome.windows.Window),
      remove: async () => undefined,
    },
  } as unknown as ChromeAPI;
}

const fallbackChromeAPI = createFallbackChromeAPI();

/**
 * Returns the best available browser extension API.
 * Prefers `browser` (Firefox native promises) over `chrome` (callbacks/MV3 promises).
 */
export const browserAPI: ChromeAPI =
  extensionGlobals.browser ?? extensionGlobals.chrome ?? fallbackChromeAPI;

/**
 * Returns true if running in Firefox
 */
export function isFirefox(): boolean {
  return typeof extensionGlobals.browser !== 'undefined' && /Firefox/.test(navigator.userAgent);
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
