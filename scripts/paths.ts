import path from 'path'

export const repositoryRoot = Bun.fileURLToPath(new URL('../', import.meta.url))
export const packagesRoot = path.join(repositoryRoot, 'packages')
export const packageRoot = (name: string) => path.join(packagesRoot, name)
export const traqRoot = packageRoot('traq')

export const cargoTargetDirectory = (root: string) =>
  path.resolve(root, Bun.env.CARGO_TARGET_DIR ?? 'target')
