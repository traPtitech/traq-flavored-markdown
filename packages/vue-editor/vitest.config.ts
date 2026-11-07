import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: ['typescript/tests/**/*.test.ts'],
    setupFiles: ['typescript/tests/setup.ts'],
    maxWorkers: 2
  }
})
