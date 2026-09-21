import path from 'path'

import * as ts from 'typescript'

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
    const syntax = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true
    )
    const checkSpecifier = (specifier: string) => {
      if (specifier.startsWith('.')) {
        const target = path.resolve(path.dirname(file), specifier)
        const relative = path.relative(packageRoot(repo), target)
        if (relative.startsWith('..' + path.sep) || relative === '..')
          throw new Error(file + ': import escapes package ownership')
      }
      if (!specifier.startsWith('@traq-markdown-engine/')) return
      const name = specifier
        .slice('@traq-markdown-engine/'.length)
        .split('/')[0]
      if (!allowed.includes(name as PackageName))
        throw new Error(file + ': upward dependency ' + name)
    }
    const visit = (node: ts.Node): void => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        checkSpecifier(node.moduleSpecifier.text)
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === 'require')) &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])
      )
        checkSpecifier(node.arguments[0].text)
      ts.forEachChild(node, visit)
    }
    visit(syntax)
    if (repo !== 'core' && /interface (?:Node|Document)\s*[<{]/.test(source))
      throw new Error(file + ': redeclared AST')
  }
  console.log(
    repo + ': ' + count + ' TypeScript modules follow owner dependencies'
  )
}
