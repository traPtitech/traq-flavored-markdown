import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { defineConfig } from '@playwright/test'

const localBrowser =
  process.platform === 'win32' && !process.env.CI
    ? [
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Google/Chrome/Application/chrome.exe'
      ].find(existsSync)
    : undefined

export default defineConfig({
  testDir: fileURLToPath(new URL('../..', import.meta.url)),
  testMatch: [
    'tests/browser/**/*.browser.spec.ts',
    'tools/corpus/viewer/**/*.browser.spec.ts'
  ],
  outputDir: '../../test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4178',
    viewport: { width: 1000, height: 900 },
    launchOptions: localBrowser ? { executablePath: localBrowser } : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'bun run test:browser:serve',
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    url: 'http://127.0.0.1:4178/tests/browser/fixtures/gallery.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  }
})
