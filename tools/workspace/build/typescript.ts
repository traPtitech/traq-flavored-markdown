import { $ } from 'bun'

import { readNpmPackageGraph } from '../package-graph.ts'
import { packageRoot } from '../paths.ts'
import { cleanBuildOutput } from './outputs.ts'

/** Prepare committed TypeScript bindings for pure tests without Cargo or Wasm. */
const { graph, manifests } = await readNpmPackageGraph()
for (const name of graph.order) {
  await cleanBuildOutput(packageRoot(name), 'typescript')
  await $.cwd(
    packageRoot(name)
  )`${Bun.argv[0]} run ${manifests[name].scripts?.['build:ts'] ? 'build:ts' : 'build'}`
}
