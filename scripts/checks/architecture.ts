import path from 'path'

import { $ } from 'bun'

import {
  packageOwner,
  readGoPackageGraph,
  readNpmPackageGraph,
  validateGoOwnership
} from '../package-graph.ts'
import { sdkRoot } from '../paths.ts'

const { graph: npmGraph } = await readNpmPackageGraph()

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
for (const crate of metadata.packages) {
  const source = packageOwner(path.dirname(crate.manifest_path))
  if (!source) continue
  for (const dependency of crate.dependencies) {
    if (dependency.kind && dependency.kind !== 'normal') continue
    const destination = dependency.path && packageOwner(dependency.path)
    if (destination && !npmGraph.allows(source, destination))
      throw new Error(
        `${crate.name}: upward Rust dependency ${dependency.name}`
      )
  }
}

const go = await readGoPackageGraph()
validateGoOwnership(go, npmGraph)

const pkg = await Bun.file(path.join(sdkRoot, 'package.json')).json()
if (Object.keys(pkg.dependencies ?? {}).length !== 0)
  throw new Error('Runtime dependencies are not allowed')
await import('./typescript-boundaries.ts')
const cargoTree = async (name: string) =>
  (
    await $.cwd(sdkRoot)`cargo tree --locked -p ${name} --edges normal`.quiet()
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
  'Dependency direction: Rust crates, Go modules, and processing presets follow ownership boundaries'
)
