import { $ } from 'bun'

import { buildTraq } from '../packages/traq/scripts/build.ts'
import { checkGenerated } from './checks/generated.ts'
import { generateBindings } from './generate-bindings.ts'
import { packageRoot } from './paths.ts'

const buildPackage = (name: 'core' | 'commonmark' | 'trap-extension') =>
  $.cwd(packageRoot(name))`${Bun.argv[0]} run build`

const args = Bun.argv.slice(2)
if (args.length === 1 && args[0] === '--check-generated') {
  await checkGenerated(generateBindings)
} else if (!args.length) {
  await generateBindings()
} else {
  throw new Error('usage: bun scripts/build.ts [--check-generated]')
}

await buildPackage('core')
await buildPackage('commonmark')
await buildPackage('trap-extension')
await buildTraq({ bindingsReady: true })
