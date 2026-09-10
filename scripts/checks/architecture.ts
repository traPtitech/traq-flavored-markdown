import path from 'path'

import { $ } from 'bun'

import { traqRoot } from '../paths.ts'

const pkg = await Bun.file(path.join(traqRoot, 'package.json')).json()
if (Object.keys(pkg.dependencies ?? {}).length !== 0)
  throw new Error('Runtime dependencies are not allowed')
await import('./typescript-boundaries.ts')
const cargoTree = async (name: string) =>
  (
    await $.cwd(traqRoot)`cargo tree --locked -p ${name} --edges normal`.quiet()
  ).text()
for (const name of [
  'traq-markdown-processing',
  'markdown-trap-text',
  'markdown-trap-extraction',
  'markdown-trap-contracts'
]) {
  const tree = await cargoTree(name)
  if (
    /markdown-parser v|markdown-codec v|traq-markdown-grammar v|traq-markdown-wasm v/.test(
      tree
    )
  )
    throw new Error(
      name +
        ': lower-level processing must not depend on parsing or distribution'
    )
}
const syntax = await cargoTree('markdown-trap-syntax')
if (/traq-markdown-grammar v|traq-markdown-wasm v/.test(syntax))
  throw new Error('Extension syntax must not depend on the traQ distribution')
console.log(
  'Dependency direction: extension components and processing presets do not depend on the distribution'
)
