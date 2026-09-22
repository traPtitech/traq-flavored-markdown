import path from 'path'

import { $ } from 'bun'

import {
  type PackageName,
  packageRoot,
  packagesRoot,
  sdkRoot
} from '../paths.ts'

const allowedOwners: Record<PackageName, PackageName[]> = {
  core: ['core'],
  'commonmark-plugin': ['core', 'commonmark-plugin'],
  'traq-plugin': ['core', 'commonmark-plugin', 'traq-plugin'],
  sdk: ['core', 'commonmark-plugin', 'traq-plugin', 'sdk']
}

const owner = (directory: string): PackageName | undefined => {
  const relative = path.relative(packagesRoot, directory)
  if (relative === '..' || relative.startsWith('..' + path.sep)) return
  const [first, second] = relative.split(path.sep)
  if (first === 'core' || first === 'sdk') return first
  if (first === 'plugins' && second === 'commonmark') return 'commonmark-plugin'
  if (first === 'plugins' && second === 'traq') return 'traq-plugin'
}

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
  const source = owner(path.dirname(crate.manifest_path))
  if (!source) continue
  for (const dependency of crate.dependencies) {
    if (dependency.kind && dependency.kind !== 'normal') continue
    const destination = dependency.path && owner(dependency.path)
    if (destination && !allowedOwners[source].includes(destination))
      throw new Error(
        `${crate.name}: upward Rust dependency ${dependency.name}`
      )
  }
}

const goModules: [PackageName, string][] = [
  ['core', path.join(packageRoot('core'), 'go', 'go.mod')],
  [
    'commonmark-plugin',
    path.join(packageRoot('commonmark-plugin'), 'go', 'go.mod')
  ],
  ['traq-plugin', path.join(packageRoot('traq-plugin'), 'go', 'go.mod')],
  ['sdk', path.join(packageRoot('sdk'), 'go', 'go.mod')],
  ['sdk', path.join(packageRoot('sdk'), 'examples', 'go', 'go.mod')]
]
for (const [source, file] of goModules) {
  const manifest = await Bun.file(file).text()
  for (const [, part] of manifest.matchAll(
    /github\.com\/uni-kakurenbo\/traq-markdown-engine\/packages\/(core|sdk|plugins\/commonmark|plugins\/traq)\/go\b/g
  )) {
    const destination = owner(path.join(packagesRoot, part))
    if (destination && !allowedOwners[source].includes(destination))
      throw new Error(`${file}: upward Go dependency ${part}`)
  }
}

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
