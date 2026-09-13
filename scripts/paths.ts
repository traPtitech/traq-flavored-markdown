import path from 'path'

export const repositoryRoot = Bun.fileURLToPath(new URL('../', import.meta.url))
export const packagesRoot = path.join(repositoryRoot, 'packages')
export type PackageName = 'core' | 'commonmark' | 'trap-extension' | 'traq'

const packageDirectories: Record<PackageName, string> = {
  core: 'core',
  commonmark: 'plugins/commonmark',
  'trap-extension': 'plugins/trap',
  traq: 'traq'
}

export const packageRoot = (name: PackageName) =>
  path.join(packagesRoot, packageDirectories[name])
export const traqRoot = packageRoot('traq')
export const corpusRoot = path.join(repositoryRoot, 'tools', 'corpus')

export const cargoTargetDirectory = () =>
  path.resolve(repositoryRoot, Bun.env.CARGO_TARGET_DIR ?? 'target')
