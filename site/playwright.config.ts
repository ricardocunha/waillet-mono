import { defineConfig } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 0,
  workers: 1, // Extensions need sequential execution

  use: {
    headless: false, // Extensions require headed mode
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
  },

  projects: [
    {
      name: 'screenshots',
      testMatch: /screenshots\.spec\.ts$/,
      use: {
        channel: 'chromium',
      },
    },
  ],

  reporter: [['list']],

  // Output directory for screenshots
  outputDir: path.join(__dirname, 'public/screenshots'),
})
