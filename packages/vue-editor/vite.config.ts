import path from 'node:path'
import { fileURLToPath } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: {
        index: path.join(root, 'typescript/src/index.ts'),
        ReferenceInput: path.join(root, 'typescript/src/ReferenceInput.vue'),
        prosemirror: path.join(root, 'typescript/src/prosemirror.ts')
      },
      formats: ['es'],
      cssFileName: 'style'
    },
    rolldownOptions: {
      external: id => !id.startsWith('.') && !path.isAbsolute(id)
    },
    emptyOutDir: true
  }
})
