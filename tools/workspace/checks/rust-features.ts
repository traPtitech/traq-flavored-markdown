import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export type CargoMetadata = {
  workspace_members: string[]
  packages: {
    id: string
    name: string
    features: Record<string, string[]>
    targets: { kind: string[] }[]
  }[]
}

export function rustFeatureChecks(metadata: CargoMetadata): string[][] {
  const members = new Set(metadata.workspace_members)
  const libraryKinds = new Set([
    'lib',
    'rlib',
    'dylib',
    'cdylib',
    'staticlib',
    'proc-macro'
  ])
  const checks: string[][] = []
  for (const crate of metadata.packages) {
    if (
      !members.has(crate.id) ||
      !crate.targets.some(target =>
        target.kind.some(kind => libraryKinds.has(kind))
      )
    )
      continue
    const base = ['check', '--locked', '--package', crate.name, '--lib']
    // Resolve each crate alone: workspace tests can supply features through
    // unrelated consumers and hide missing dependency-feature propagation.
    const combinations = Object.keys(crate.features)
      .filter(feature => feature !== 'default')
      .sort()
      .reduce<string[][]>(
        (sets, feature) => [...sets, ...sets.map(set => [...set, feature])],
        [[]]
      )
    for (const features of combinations)
      checks.push([
        ...base,
        '--no-default-features',
        ...(features.length ? ['--features', features.join(',')] : [])
      ])
    if (crate.features.default?.length) checks.push(base)
  }
  return checks
}

if (import.meta.main) {
  const cwd = fileURLToPath(new URL('../../../', import.meta.url))
  const metadata = spawnSync(
    'cargo',
    ['metadata', '--locked', '--no-deps', '--format-version', '1'],
    { cwd, encoding: 'utf8' }
  )
  if (metadata.error) throw metadata.error
  if (metadata.status !== 0)
    throw new Error(metadata.stderr || 'cargo metadata failed')
  const checks = rustFeatureChecks(JSON.parse(metadata.stdout) as CargoMetadata)
  for (const args of checks) {
    console.log('cargo ' + args.join(' '))
    const result = spawnSync('cargo', args, { cwd, stdio: 'inherit' })
    if (result.error) throw result.error
    if (result.status !== 0) process.exit(result.status ?? 1)
  }
  console.log(`${checks.length} independent Rust feature checks passed`)
}
