import { readFile, rename, writeFile } from 'node:fs/promises'

const directory = new URL('../dist/', import.meta.url)
const entry = new URL('index.d.ts', directory)
const source = await readFile(entry, 'utf8')
if (!source.includes('./ReferenceInput.vue')) {
  throw new Error('Missing generated Vue component declaration')
}

await writeFile(
  entry,
  source
    .replace(/^import ['"]\.\/style\.css['"];?\r?\n/m, '')
    .replace(/(['"])\.\/ReferenceInput\.vue\1/g, "'./ReferenceInput.js'")
)

await rename(
  new URL('ReferenceInput.vue.d.ts', directory),
  new URL('ReferenceInput.d.ts', directory)
)
