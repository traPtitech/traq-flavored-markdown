import path from 'path'

import { readNpmPackageGraph } from '../package-graph.ts'
import { packageRoot } from '../paths.ts'
import { importSpecifiers } from './import-specifiers.ts'
import { validateTypescriptDependency } from './typescript-dependencies.ts'

const { manifests, graph } = await readNpmPackageGraph()

const byName = new Map(
  graph.order.map(name => [manifests[name].name, name] as const)
)

for (const owner of graph.order) {
  const directory = path.join(packageRoot(owner), 'typescript', 'src')
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

    for (const specifier of importSpecifiers(file, source)) {
      validateTypescriptDependency({
        owner,
        root: packageRoot(owner),
        file,
        specifier,
        manifest: manifests[owner],
        owners: byName
      })
    }

    if (owner !== 'core' && /interface (?:Node|Document)\s*[<{]/.test(source)) {
      throw new Error(file + ': redeclared AST')
    }
  }

  console.log(
    owner + ': ' + count + ' TypeScript modules follow owner dependencies'
  )
}
