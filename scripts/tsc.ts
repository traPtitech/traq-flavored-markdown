import path from 'node:path'

import { $ } from 'bun'

const compiler = path.join(
  path.dirname(
    Bun.fileURLToPath(import.meta.resolve('@typescript/native/package.json'))
  ),
  'bin/tsc'
)
await $`node ${compiler} ${Bun.argv.slice(2)}`
