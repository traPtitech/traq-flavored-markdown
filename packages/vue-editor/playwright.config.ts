import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './browser-tests',
  testMatch: '**/*.test.ts',
  workers: 2,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4181/examples/tasks/',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'bunx vite --config browser-tests/vite.config.ts',
    url: 'http://127.0.0.1:4181/examples/tasks/',
    timeout: 60000
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    {
      name: 'firefox',
      use: devices['Desktop Firefox'],
      grepInvert: /@chromium/
    },
    { name: 'webkit', use: devices['Desktop Safari'], grepInvert: /@chromium/ },
    { name: 'mobile-chromium', use: devices['Pixel 7'], grep: /@mobile/ },
    {
      name: 'mobile-webkit',
      use: devices['iPhone 13'],
      grep: /@mobile/,
      grepInvert: /@chromium/
    }
  ]
})
