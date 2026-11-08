import path from 'node:path'

import { allowsOwner } from '../descriptor.ts'
import type { NpmManifest } from '../package-graph.ts'
import type { PackageName } from '../paths.ts'

export function validateTypescriptDependency(options: {
  owner: PackageName
  root: string
  file: string
  specifier: string
  manifest: NpmManifest
  owners: ReadonlyMap<string, PackageName>
}): void {
  const { owner, root, file, specifier, manifest, owners } = options

  const fail = (message: string): never => {
    throw new Error(file + ': ' + message)
  }

  if (specifier.startsWith('/@/') || specifier.startsWith('@/')) {
    fail('application alias ' + specifier)
  }

  if (specifier.startsWith('.')) {
    const relative = path.relative(
      root,
      path.resolve(path.dirname(file), specifier)
    )
    if (
      relative === '..' ||
      relative.startsWith('..' + path.sep) ||
      path.isAbsolute(relative)
    ) {
      fail('import escapes package ownership')
    }

    return
  }

  if (
    specifier.startsWith('node:') ||
    specifier === 'bun' ||
    specifier.startsWith('bun:')
  ) {
    fail('host runtime dependency in a public package: ' + specifier)
  }

  if (
    owner !== 'vue-editor' &&
    /^(?:vue$|@vueuse\/|@tiptap\/)/.test(specifier)
  ) {
    fail('UI dependency in a portable package')
  }

  const name = specifier
    .split('/')
    .slice(0, specifier.startsWith('@') ? 2 : 1)
    .join('/')

  const dependency = owners.get(name)

  if (
    name.startsWith('@traq-flavored-markdown/') &&
    (!dependency || !allowsOwner(owner, dependency))
  ) {
    fail('upward dependency ' + name)
  }

  if (
    name !== manifest.name &&
    !Object.hasOwn(manifest.dependencies ?? {}, name) &&
    !Object.hasOwn(manifest.peerDependencies ?? {}, name)
  ) {
    fail('undeclared public dependency ' + name)
  }
}
