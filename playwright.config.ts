import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 45_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.FABELPAD_TEST_URL || 'http://127.0.0.1:3017',
    browserName: 'chromium',
    launchOptions: process.env.FABELPAD_CHROMIUM_PATH ? { executablePath: process.env.FABELPAD_CHROMIUM_PATH } : {},
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
