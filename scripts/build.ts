import { $ } from 'bun'

import { buildSdk } from '../packages/sdk/scripts/build.ts'
import { checkGenerated } from './checks/generated.ts'
import { generateBindings } from './generate-bindings.ts'
import { readNpmPackageGraph } from './package-graph.ts'
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

const { graph } = await readNpmPackageGraph()
for (const name of graph.order)
  if (name === 'sdk')
    await buildSdk({ bindingsReady: true, checkGenerated: check })
  else await buildPackage(name)
