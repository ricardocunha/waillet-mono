import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { webcrypto } from 'crypto';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Use Node.js Web Crypto API directly
// Note: Some ethers.js wallet tests are skipped due to Buffer/Uint8Array incompatibility
// but the crypto utils (encrypt/decrypt) work fine
Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  writable: true
});

// Provide a minimal extension API mock for tests that import browserAPI.
const extensionStorage: Record<string, unknown> = {};

const chromeMock = {
  runtime: {
    getURL: (path: string) => path,
    sendMessage: async () => undefined,
    onMessage: {
      addListener: () => undefined,
      removeListener: () => undefined,
      hasListener: () => false,
    },
    onInstalled: {
      addListener: () => undefined,
      removeListener: () => undefined,
      hasListener: () => false,
    },
  },
  storage: {
    local: {
      get: async (keys?: string | string[] | Record<string, unknown> | null) => {
        if (keys == null) return { ...extensionStorage };
        if (typeof keys === 'string') return { [keys]: extensionStorage[keys] };
        if (Array.isArray(keys)) {
          const result: Record<string, unknown> = {};
          keys.forEach((key) => {
            result[key] = extensionStorage[key];
          });
          return result;
        }

        const result: Record<string, unknown> = {};
        Object.keys(keys).forEach((key) => {
          result[key] = Object.prototype.hasOwnProperty.call(extensionStorage, key)
            ? extensionStorage[key]
            : keys[key];
        });
        return result;
      },
      set: async (items: Record<string, unknown>) => {
        Object.assign(extensionStorage, items);
      },
      remove: async (keys: string | string[]) => {
        const list = Array.isArray(keys) ? keys : [keys];
        list.forEach((key) => delete extensionStorage[key]);
      },
      clear: async () => {
        Object.keys(extensionStorage).forEach((key) => delete extensionStorage[key]);
      },
    },
    onChanged: {
      addListener: () => undefined,
      removeListener: () => undefined,
      hasListener: () => false,
    },
  },
  windows: {
    onRemoved: {
      addListener: () => undefined,
      removeListener: () => undefined,
      hasListener: () => false,
    },
    get: async () => undefined,
    update: async () => undefined,
    create: async () => ({ id: 1 }),
    remove: async () => undefined,
  },
  tabs: {
    sendMessage: async () => undefined,
  },
};

Object.defineProperty(globalThis, 'chrome', {
  value: chromeMock,
  writable: true,
});
