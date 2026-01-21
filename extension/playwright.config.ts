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
      name: 'chromium',
      use: {
        channel: 'chromium',
      },
    },
  ],

  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
});
