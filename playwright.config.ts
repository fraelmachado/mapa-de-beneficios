import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  globalSetup: './tests/e2e/global-setup.ts',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
  },
  projects: [
    { name: 'mobile-light', use: { viewport: { width: 390, height: 844 } } },
    { name: 'mobile-dark', use: { viewport: { width: 390, height: 844 } } },
    { name: 'desktop-light', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'desktop-dark', use: { viewport: { width: 1440, height: 900 } } },
  ],
})
