import path from 'node:path'

import { npmPackageGraph } from './package-graph.ts'
import {
  type PackageName,
  packageNames,
  packageRoot,
  repositoryRoot
} from './paths.ts'

const registry = 'https://registry.npmjs.org'
const packageName = (name: PackageName) => `@traq-flavored-markdown/${name}`
const versionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

type Mode = 'prepare' | 'check' | 'dry-run' | 'publish'

export type Release = {
  version: string
  tag: 'latest' | 'next'
  mode: Mode
}

export type Manifest = {
  name: string
  version: string
  private?: boolean
  publishConfig?: { access?: string; registry?: string }
  peerDependencies?: Record<string, string>
}

export type Workspace = {
  root: Manifest
  packages: Record<PackageName, Manifest>
}

const usage =
  'usage: bun scripts/release.ts v<version> [--prepare|--check|--dry-run|--publish]'

const validVersion = (version: string) => {
  const match = version.match(versionPattern)
  return (
    !!match &&
    !match[5] &&
    Bun.semver.satisfies(version, `=${version}`) &&
    !match[4]?.split('.').some(identifier => /^0\d+$/.test(identifier))
  )
}

const internalPeers = (manifest: Manifest, workspace: Workspace) =>
  Object.entries(manifest.peerDependencies ?? {}).filter(([dependency]) =>
    packageNames.some(name => workspace.packages[name].name === dependency)
  )

export const parseRelease = (args: string[]): Release => {
  const [label, ...options] = args
  const version = label?.startsWith('v') ? label.slice(1) : undefined
  if (!version || !validVersion(version) || options.length > 1)
    throw new Error(usage)
  const mode =
    options[0] === '--prepare'
      ? 'prepare'
      : options[0] === '--check'
        ? 'check'
        : options[0] === '--publish'
          ? 'publish'
          : !options.length || options[0] === '--dry-run'
            ? 'dry-run'
            : undefined
  if (!mode) throw new Error(usage)
  return { version, tag: version.includes('-') ? 'next' : 'latest', mode }
}

export const validateWorkspace = (workspace: Workspace, version?: string) => {
  if (
    workspace.root.name !== 'traq-flavored-markdown' ||
    workspace.root.private !== true
  )
    throw new Error('root manifest does not match the synchronized release')
  if (
    version !== undefined &&
    (!validVersion(version) || workspace.root.version !== version)
  )
    throw new Error('root manifest does not match the synchronized release')

  const graph = npmPackageGraph(workspace.packages)
  for (const name of graph.order) {
    const manifest = workspace.packages[name]
    if (
      manifest.name !== packageName(name) ||
      manifest.private !== undefined ||
      manifest.publishConfig?.access !== 'public' ||
      manifest.publishConfig.registry !== registry
    )
      throw new Error(
        `${name} manifest does not match the synchronized release`
      )
    if (version !== undefined && manifest.version !== version)
      throw new Error(
        `${name} manifest does not match the synchronized release`
      )
    const peers = internalPeers(manifest, workspace)
    if (
      version !== undefined &&
      peers.some(([, peerVersion]) => peerVersion !== version)
    )
      throw new Error(`${name} peer dependencies do not match the release`)
  }
  return graph
}

const readWorkspace = async (): Promise<Workspace> => ({
  root: (await Bun.file(
    path.join(repositoryRoot, 'package.json')
  ).json()) as Manifest,
  packages: Object.fromEntries(
    await Promise.all(
      packageNames.map(
        async name =>
          [
            name,
            (await Bun.file(
              path.join(packageRoot(name), 'package.json')
            ).json()) as Manifest
          ] as const
      )
    )
  ) as Record<PackageName, Manifest>
})

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const run = async (args: string[]) => {
  const subprocess = Bun.spawn(args, {
    cwd: repositoryRoot,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit'
  })
  if ((await subprocess.exited) !== 0) throw new Error(`${args[0]} failed`)
}

export const runRelease = async (args: string[]) => {
  const release = parseRelease(args)
  const workspace = await readWorkspace()
  const graph = validateWorkspace(
    workspace,
    release.mode === 'prepare' ? undefined : release.version
  )
  const workspaces = graph.order.map(
    name => `--workspace=${workspace.packages[name].name}`
  )
  if (release.mode === 'prepare') {
    await run([
      npm,
      'version',
      release.version,
      ...workspaces,
      '--include-workspace-root',
      '--workspaces-update=false',
      '--git-tag-version=false',
      '--ignore-scripts',
      '--allow-same-version'
    ])
    for (const name of graph.order) {
      const fields = internalPeers(workspace.packages[name], workspace).map(
        ([peer]) => `peerDependencies.${peer}=${release.version}`
      )
      if (fields.length)
        await run([
          npm,
          'pkg',
          'set',
          ...fields,
          `--workspace=${workspace.packages[name].name}`
        ])
    }
    validateWorkspace(await readWorkspace(), release.version)
    await run([Bun.argv[0], 'install', '--lockfile-only', '--ignore-scripts'])
    return
  }

  if (release.mode === 'check') return
  await run([
    npm,
    'publish',
    ...workspaces,
    '--ignore-scripts',
    '--access',
    'public',
    `--registry=${registry}`,
    '--tag',
    release.tag,
    ...(release.mode === 'dry-run' ? ['--dry-run'] : [])
  ])
}

if (Bun.main === Bun.fileURLToPath(import.meta.url))
  await runRelease(Bun.argv.slice(2))
