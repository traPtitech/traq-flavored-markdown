import { fileURLToPath } from 'node:url'

export default {
  root: fileURLToPath(new URL('../..', import.meta.url)),
  server: {
    strictPort: true,
    watch: { ignored: ['**/target/**', '**/.private/**', '**/test-results/**'] }
  },
  optimizeDeps: {
    entries: [
      'tests/browser/fixtures/gallery.html',
      'tools/corpus/viewer/index.html'
    ]
  },
  esbuild: { jsx: 'automatic' }
}
