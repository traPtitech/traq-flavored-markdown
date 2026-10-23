import { $ } from 'bun'

import { readNpmPackageGraph } from './package-graph.ts'
import { corpusRoot, packageRoot, repositoryRoot } from './paths.ts'

await $.cwd(
  repositoryRoot
)`${Bun.argv[0]} run tools/workspace/tsc.ts -p tsconfig.json`
const { graph } = await readNpmPackageGraph()
for (const name of graph.order) {
  // Production sources also compile without Bun or browser DOM globals.
  await $.cwd(
    repositoryRoot
  )`${Bun.argv[0]} run tools/workspace/tsc.ts -p ${packageRoot(name)}/typescript/tsconfig.build.json --noEmit`
  await $.cwd(packageRoot(name))`${Bun.argv[0]} run typecheck`
}
await $.cwd(corpusRoot)`${Bun.argv[0]} run typecheck`
