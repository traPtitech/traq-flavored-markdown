import path from 'path'

export const repositoryRoot = Bun.fileURLToPath(new URL('../', import.meta.url))
export const packagesRoot = path.join(repositoryRoot, 'packages')
export const packageRoot = (name: string) => path.join(packagesRoot, name)
export const traqRoot = packageRoot('traq')

export const cargoTargetDirectory = () =>
  path.resolve(repositoryRoot, Bun.env.CARGO_TARGET_DIR ?? 'target')
