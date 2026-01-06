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

