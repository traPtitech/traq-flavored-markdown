import { $ } from 'bun'

import { buildSdk } from '../packages/sdk/scripts/build.ts'
import { checkGenerated } from './checks/generated.ts'
import { generateBindings } from './generate-bindings.ts'
import { packageRoot } from './paths.ts'

const buildPackage = (name: 'core' | 'commonmark-plugin' | 'traq-plugin') =>
  $.cwd(packageRoot(name))`${Bun.argv[0]} run build`

const args = Bun.argv.slice(2)
const check = args.length === 1 && args[0] === '--check-generated'
if (check) {
  await checkGenerated()
} else if (!args.length) {
  await generateBindings()
} else {
  throw new Error('usage: bun scripts/build.ts [--check-generated]')
}

await buildPackage('core')
await buildPackage('commonmark-plugin')
await buildPackage('traq-plugin')
await buildSdk({ bindingsReady: true, checkGenerated: check })
