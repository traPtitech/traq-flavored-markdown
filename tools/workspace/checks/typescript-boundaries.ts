import path from 'path'

import { allowsOwner } from '../descriptor.ts'
import { readNpmPackageGraph } from '../package-graph.ts'
import { packageRoot } from '../paths.ts'
import { importSpecifiers } from './import-specifiers.ts'

const { manifests, graph } = await readNpmPackageGraph()

const byName = new Map(
  graph.order.map(name => [manifests[name].name, name] as const)
)

for (const repo of graph.order) {
  const directory = path.join(packageRoot(repo), 'typescript', 'src')
  let count = 0

  for await (const relative of new Bun.Glob('**/*.{ts,vue}').scan({
    cwd: directory,
    onlyFiles: true
  })) {
    count++
    const file = path.join(directory, relative)
    const source = await Bun.file(file).text()
    if (source.includes('@traptitech/traq-markdown-it')) {
      throw new Error(file + ': retired package dependency')
    }

    const checkSpecifier = (specifier: string) => {
      if (specifier.startsWith('/@/') || specifier.startsWith('@/')) {
        throw new Error(file + ': application alias ' + specifier)
      }

      if (
        repo !== 'vue-editor' &&
        /^(?:vue$|@vueuse\/|@tiptap\/)/.test(specifier)
      ) {
        throw new Error(file + ': UI dependency in a portable package')
      }

      if (specifier.startsWith('.')) {
        const target = path.resolve(path.dirname(file), specifier)
        const relative = path.relative(packageRoot(repo), target)
        if (relative.startsWith('..' + path.sep) || relative === '..') {
          throw new Error(file + ': import escapes package ownership')
        }
      }

      if (!specifier.startsWith('@traq-flavored-markdown/')) return

      const name = specifier.split('/').slice(0, 2).join('/')
      const dependency = byName.get(name)
      if (!dependency || !allowsOwner(repo, dependency)) {
        throw new Error(file + ': upward dependency ' + name)
      }
    }

    for (const specifier of importSpecifiers(file, source)) {
      checkSpecifier(specifier)
    }

    if (repo !== 'core' && /interface (?:Node|Document)\s*[<{]/.test(source)) {
      throw new Error(file + ': redeclared AST')
    }
  }

  console.log(
    repo + ': ' + count + ' TypeScript modules follow owner dependencies'
  )
}
