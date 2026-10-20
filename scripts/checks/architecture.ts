import path from 'path'

import { $ } from 'bun'

import {
  packageOwner,
  readGoPackageGraph,
  readNpmPackageGraph,
  validateGoOwnership
} from '../package-graph.ts'
import { sdkRoot } from '../paths.ts'
import { crateRestrictions } from '../workspace/descriptor.ts'
import {
  type WorkspaceModule,
  validateCapabilities,
  validateModules
} from '../workspace/policy.ts'

await readNpmPackageGraph()

type CargoMetadata = {
  packages: {
    name: string
    manifest_path: string
    dependencies: { name: string; kind: string | null; path: string | null }[]
  }[]
}

const metadata = (
  await $`cargo metadata --locked --no-deps --format-version 1`.quiet()
).json() as CargoMetadata
const modules: WorkspaceModule[] = []
for (const crate of metadata.packages) {
  const source = packageOwner(path.dirname(crate.manifest_path))
  if (!source) continue
  modules.push({
    name: crate.name,
    owner: source,
    dependencies: crate.dependencies
      .filter(dependency => !dependency.kind || dependency.kind === 'normal')
      .map(dependency => dependency.name)
  })
}
validateModules(modules, false)
// Resolve each restricted root separately: workspace feature unification would
// otherwise combine optional syntax/text capabilities from unrelated consumers.
for (const name of Object.keys(crateRestrictions)) {
  const tree = (
    await $`cargo tree --locked --package ${name} --edges normal --prefix none --format {p}`.quiet()
  ).text()
  validateCapabilities(
    name,
    new Set(
      tree
        .trim()
        .split(/\r?\n/)
        .map(line => line.split(' ')[0])
    )
  )
}

const go = await readGoPackageGraph()
validateGoOwnership(go)

const pkg = await Bun.file(path.join(sdkRoot, 'package.json')).json()
if (Object.keys(pkg.dependencies ?? {}).length !== 0)
  throw new Error('Runtime dependencies are not allowed')
await import('./typescript-boundaries.ts')
console.log(
  'Dependency direction: Rust crates, Go modules, and processing presets follow ownership boundaries'
)
