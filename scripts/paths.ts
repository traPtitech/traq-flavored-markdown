import path from 'path'

export const repositoryRoot = Bun.fileURLToPath(new URL('../', import.meta.url))
export const packagesRoot = path.join(repositoryRoot, 'packages')
export type PackageName = 'core' | 'commonmark-plugin' | 'traq-plugin' | 'sdk'

const packageDirectories: Record<PackageName, string> = {
  core: 'core',
  'commonmark-plugin': 'plugins/commonmark',
  'traq-plugin': 'plugins/traq',
  sdk: 'sdk'
}

export const packageNames = Object.keys(packageDirectories) as PackageName[]

export const packageRoot = (name: PackageName) =>
  path.join(packagesRoot, packageDirectories[name])
export const packageOutputRoot = (name: PackageName, outputRoot: string) =>
  path.join(outputRoot, path.relative(repositoryRoot, packageRoot(name)))
export const sdkRoot = packageRoot('sdk')
export const corpusRoot = path.join(repositoryRoot, 'tools', 'corpus')

export const cargoTargetDirectory = () =>
  path.resolve(repositoryRoot, Bun.env.CARGO_TARGET_DIR ?? 'target')
