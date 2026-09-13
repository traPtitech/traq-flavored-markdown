import path from 'path'

import { type PackageName, packageRoot } from '../paths.ts'

const packages: [PackageName, PackageName[]][] = [
  ['core', []],
  ['commonmark-plugin', ['core', 'commonmark-plugin']],
  ['traq-plugin', ['core', 'commonmark-plugin', 'traq-plugin']],
  ['sdk', ['core', 'commonmark-plugin', 'traq-plugin', 'sdk']]
]
for (const [repo, allowed] of packages) {
  const directory = path.join(packageRoot(repo), 'typescript')
  let count = 0
  for await (const relative of new Bun.Glob('**/*.ts').scan({
    cwd: directory,
    onlyFiles: true
  })) {
    if (relative.split(/[\\/]/).includes('tests')) continue
    count++
    const file = path.join(directory, relative)
    const source = await Bun.file(file).text()
    if (source.includes('@traptitech/traq-markdown-it'))
      throw new Error(file + ': retired package dependency')
    for (const [, name] of source.matchAll(
      /from ['"]@traq-markdown-engine\/([^/'"]+)/g
    ))
      if (!allowed.includes(name as PackageName))
        throw new Error(file + ': upward dependency ' + name)
    if (repo !== 'core' && /interface (?:Node|Document)\s*[<{]/.test(source))
      throw new Error(file + ': redeclared AST')
  }
  console.log(
    repo + ': ' + count + ' TypeScript modules follow owner dependencies'
  )
}
