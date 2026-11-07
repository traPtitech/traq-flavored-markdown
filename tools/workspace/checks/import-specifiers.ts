import * as ts from 'typescript'
import { parse } from '@vue/compiler-sfc'

/** Read authored dependencies, including type imports and external SFC scripts. */
export function importSpecifiers(file: string, source: string): string[] {
  const specifiers: string[] = []
  let scripts = [{ content: source, lang: 'ts' }]
  if (file.endsWith('.vue')) {
    const { descriptor, errors } = parse(source, {
      filename: file,
      sourceMap: false
    })
    if (errors.length)
      throw new Error(
        file +
          ': invalid Vue SFC: ' +
          errors.map(error => error.message).join('; ')
      )
    scripts = []
    for (const block of [descriptor.script, descriptor.scriptSetup]) {
      if (!block) continue
      if (block.src) specifiers.push(block.src)
      scripts.push({ content: block.content, lang: block.lang ?? 'js' })
    }
  }
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      specifiers.push(node.moduleSpecifier.text)
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require')) &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    )
      specifiers.push(node.arguments[0].text)
    ts.forEachChild(node, visit)
  }
  for (const script of scripts)
    visit(
      ts.createSourceFile(
        file,
        script.content,
        ts.ScriptTarget.Latest,
        true,
        script.lang === 'jsx' || script.lang === 'tsx'
          ? ts.ScriptKind.TSX
          : ts.ScriptKind.TS
      )
    )
  return specifiers
}
