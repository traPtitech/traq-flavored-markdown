import path from 'node:path'

import { captureProcess, runProcess } from './infrastructure/process.ts'
import { npmPackageGraph } from './package-graph.ts'
import {
  type PackageName,
  packageNames,
  packageRoot,
  repositoryRoot
} from './paths.ts'
import { runGoRelease } from './release-go.ts'
import {
  type ReleasePorts,
  inspectRelease,
  loadReleasePlan,
  resumeRelease
} from './release/plan.ts'
import { parseVersion } from './release/version.ts'

const registry = 'https://registry.npmjs.org'
const packageName = (name: PackageName) => `@traq-flavored-markdown/${name}`
type Mode =
  | 'prepare'
  | 'check'
  | 'dry-run'
  | 'publish'
  | 'plan'
  | 'files'
  | 'inspect'
  | 'resume'

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
  'usage: bun tools/workspace/release.ts v<version> [--prepare|--check|--dry-run|--plan|--files|--inspect|--publish|--resume]'

const validVersion = (version: string) => {
  try {
    parseVersion(version)
    return true
  } catch {
    return false
  }
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
  const mode = (options[0]?.slice(2) ?? 'dry-run') as Mode
  if (
    (options[0] && !options[0].startsWith('--')) ||
    ![
      'prepare',
      'check',
      'dry-run',
      'publish',
      'plan',
      'files',
      'inspect',
      'resume'
    ].includes(mode)
  )
    throw new Error(usage)
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

const run = (args: string[]) =>
  runProcess(args[0], args.slice(1), repositoryRoot)
const capture = async (args: string[]) =>
  (await captureProcess(args[0], args.slice(1), repositoryRoot)).trim()

const releasePorts: ReleasePorts = {
  async npmVersion(name, version) {
    const response = await fetch(
      `${registry}/${encodeURIComponent(name)}/${version}`
    )
    if (response.status === 404) return false
    if (!response.ok)
      throw new Error(
        `Cannot inspect ${name}@${version}: HTTP ${response.status}`
      )
    return true
  },
  async tagRevision(tag) {
    const refs = (
      await capture([
        'git',
        'ls-remote',
        '--tags',
        'origin',
        `refs/tags/${tag}`,
        `refs/tags/${tag}^{}`
      ])
    )
      .split('\n')
      .filter(Boolean)
      .map(line => line.split(/\s+/))
    return refs.find(([, name]) => name.endsWith('^{}'))?.[0] ?? refs[0]?.[0]
  },
  publishPackage: (name, version) =>
    run([
      npm,
      'publish',
      `--workspace=${name}`,
      '--ignore-scripts',
      '--access',
      'public',
      `--registry=${registry}`,
      '--tag',
      version.distTag
    ]),
  async publishTag(tag, revision) {
    const existing = await capture(['git', 'tag', '--list', tag])
    if (existing) {
      const local = await capture(['git', 'rev-parse', `refs/tags/${tag}^{}`])
      if (local !== revision)
        throw new Error(
          `Local tag ${tag} points to ${local}, expected ${revision}`
        )
    } else await run(['git', 'tag', '-a', tag, revision, '-m', tag])
    await run(['git', 'push', 'origin', `refs/tags/${tag}`])
  }
}

export const runRelease = async (args: string[]) => {
  const release = parseRelease(args)
  const plan = await loadReleasePlan(`v${release.version}`)
  if (
    ['plan', 'files', 'inspect', 'resume', 'publish'].includes(release.mode)
  ) {
    if (release.mode === 'plan') {
      console.log(JSON.stringify(plan, null, 2))
      return
    }
    if (release.mode === 'files') {
      for (const file of plan.changedFiles)
        if (await Bun.file(path.join(repositoryRoot, file)).exists())
          console.log(file)
      return
    }
    validateWorkspace(await readWorkspace(), release.version)
    await runGoRelease([plan.version.tag, '--check'])
    const revision = await capture(['git', 'rev-parse', 'HEAD'])
    if (release.mode === 'inspect')
      console.log(
        JSON.stringify(
          await inspectRelease(plan, revision, releasePorts),
          null,
          2
        )
      )
    else
      await resumeRelease(
        plan,
        revision,
        releasePorts,
        release.mode === 'publish'
      )
    return
  }
  const workspace = await readWorkspace()
  const graph = validateWorkspace(
    workspace,
    release.mode === 'prepare' ? undefined : release.version
  )
  const workspaces = plan.packages.map(item => `--workspace=${item.name}`)
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
    await runGoRelease([plan.version.tag, '--prepare'])
    return
  }

  await runGoRelease([plan.version.tag, '--check'])
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
