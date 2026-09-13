import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  root: __dirname,
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: '../../dist',
    emptyOutDir: true
  }
})
