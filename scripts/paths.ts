import path from 'path'

import {
  type PackageName,
  owners,
  packageNames
} from './workspace/descriptor.ts'

export { packageNames, type PackageName }

export const repositoryRoot = Bun.fileURLToPath(new URL('../', import.meta.url))
export const packagesRoot = path.join(repositoryRoot, 'packages')
export const packageRoot = (name: PackageName) =>
  path.join(repositoryRoot, owners[name].directory)
export const packageOutputRoot = (
  name: PackageName,
  outputRoot = repositoryRoot
) => path.join(outputRoot, path.relative(repositoryRoot, packageRoot(name)))
export const sdkRoot = packageRoot('sdk')
export const corpusRoot = path.join(repositoryRoot, 'tools', 'corpus')

export const cargoTargetDirectory = () =>
  path.resolve(repositoryRoot, Bun.env.CARGO_TARGET_DIR ?? 'target')
