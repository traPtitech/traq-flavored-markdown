import { nodeGroup } from '../../../../scripts/codegen/groups.ts'

export function goNodes(manifest: {
  nodes: Record<string, { group: string }>
}) {
  const groups = [
    ...new Set(Object.values(manifest.nodes).map(node => node.group))
  ]
  for (const group of groups) nodeGroup(group)

  return (
    '// Code generated from Rust contract ownership. DO NOT EDIT.\npackage markdown\nimport (\n "github.com/uni-kakurenbo/traq-markdown-engine/packages/core/go/ast"\n' +
    groups
      .map(
        group =>
          group +
          ' "github.com/uni-kakurenbo/traq-markdown-engine/packages/' +
          nodeGroup(group).goPackage +
          '"'
      )
      .join('\n') +
    '\n)\n' +
    'type Document = ast.Document\ntype Node = ast.Node\ntype Span = ast.Span\ntype Payload = ast.Payload\n' +
    'func DecodeDocument(raw []byte) (*Document,error) { return ast.DecodeDocument(raw, newPayload) }\n' +
    'func newPayload(kind string) ast.Payload {\n' +
    groups
      .map(
        group =>
          'if value := ' +
          group +
          '.NewPayload(kind); value != nil { return value }'
      )
      .join('\n') +
    '\nreturn nil\n}\n'
  )
}
