import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  workers: 1, // Extensions need sequential execution

  use: {
    headless: false, // Extensions require headed mode
    viewport: { width: 400, height: 600 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'extension',
      testMatch: /^(?!.*uniswap).*\.spec\.ts$/,
      use: {
        channel: 'chromium',
      },
    },
    {
      name: 'uniswap',
      testMatch: /uniswap\.spec\.ts$/,
      timeout: 120000, // 2 minutes for blockchain operations
      use: {
        channel: 'chromium',
        viewport: { width: 1280, height: 800 }, // Larger viewport for Uniswap
      },
    },
  ],

  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
});
