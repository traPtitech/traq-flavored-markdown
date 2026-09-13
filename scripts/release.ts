import path from 'node:path'

import { type PackageName, packageRoot } from './paths.ts'

const registry = 'https://registry.npmjs.org'
const packages: Record<PackageName, string> = {
  core: '@traq-markdown-engine/core',
  'commonmark-plugin': '@traq-markdown-engine/commonmark-plugin',
  'traq-plugin': '@traq-markdown-engine/traq-plugin',
  sdk: '@traq-markdown-engine/sdk'
}
const versionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

type Mode = 'check' | 'dry-run' | 'publish'

export type Release = {
  name: PackageName
  version: string
  tag: 'latest' | 'next'
  mode: Mode
}

type Manifest = {
  name: string
  version: string
  private?: boolean
  publishConfig?: { access?: string; registry?: string }
}

const usage =
  'usage: bun scripts/release.ts <core|commonmark-plugin|traq-plugin|sdk>@<version> [--check|--dry-run|--publish]'

const validVersion = (version: string) => {
  const match = version.match(versionPattern)
  if (!match || match[5] || !Bun.semver.satisfies(version, `=${version}`))
    return false
  return !match[4]?.split('.').some(id => /^0\d+$/.test(id))
}

export const parseRelease = (args: string[]): Release => {
  const [selector, ...options] = args
  const [name, version, ...rest] = selector?.split('@') ?? []
  if (
    !name ||
    !version ||
    rest.length ||
    !Object.hasOwn(packages, name) ||
    !validVersion(version)
  )
    throw new Error(usage)
  if (options.length > 1) throw new Error(usage)

  const mode =
    options[0] === '--check'
      ? 'check'
      : options[0] === '--publish'
        ? 'publish'
        : !options.length || options[0] === '--dry-run'
          ? 'dry-run'
          : undefined
  if (!mode) throw new Error(usage)
  return {
    name: name as PackageName,
    version,
    tag: version.includes('-') ? 'next' : 'latest',
    mode
  }
}

export const validateRelease = async (release: Release) => {
  const manifest = (await Bun.file(
    path.join(packageRoot(release.name), 'package.json')
  ).json()) as Manifest
  if (
    manifest.name !== packages[release.name] ||
    manifest.version !== release.version ||
    manifest.private !== undefined ||
    manifest.publishConfig?.access !== 'public' ||
    manifest.publishConfig.registry !== registry
  )
    throw new Error(`release selector does not match ${release.name} manifest`)
}

export const runRelease = async (args: string[]) => {
  const release = parseRelease(args)
  await validateRelease(release)
  if (release.mode === 'check') {
    console.log(
      `${release.name}@${release.version} is ready for ${release.tag}`
    )
    return
  }

  const command = [
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    'publish',
    '--ignore-scripts',
    '--access',
    'public',
    '--registry',
    registry,
    '--tag',
    release.tag,
    ...(release.mode === 'dry-run' ? ['--dry-run'] : [])
  ]
  const subprocess = Bun.spawn(command, {
    cwd: packageRoot(release.name),
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit'
  })
  if ((await subprocess.exited) !== 0)
    throw new Error(`npm publish failed for ${release.name}`)
}

if (Bun.main === Bun.fileURLToPath(import.meta.url))
  await runRelease(Bun.argv.slice(2))
