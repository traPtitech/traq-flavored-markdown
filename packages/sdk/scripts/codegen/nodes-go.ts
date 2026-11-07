import { nodeGroup } from '../../../../tools/contracts/model/groups.ts'

export function goNodes(manifest: {
  nodes: Record<string, { group: string }>
}) {
  const groups = [
    ...new Set(Object.values(manifest.nodes).map(node => node.group))
  ]

  for (const group of groups) nodeGroup(group)

  return (
    '// Code generated from Rust contract ownership. DO NOT EDIT.\npackage markdown\n\nimport (\n "github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"\n' +
    groups
      .map(
        group =>
          group +
          ' "github.com/traPtitech/traq-flavored-markdown/packages/' +
          nodeGroup(group).goPackage +
          '"'
      )
      .join('\n') +
    '\n)\n\n' +
    'type Document = ast.Document\ntype Node = ast.Node\ntype MutableDocument = ast.MutableDocument\ntype MutableNode = ast.MutableNode\ntype Span = ast.Span\ntype Payload = ast.Payload\n\n' +
    'func DecodeDocument(raw []byte) (*Document,error) { return ast.DecodeDocument(raw, newPayload) }\n\n' +
    'func NewDocument(document *MutableDocument) (*Document,error) { return ast.NewDocument(document, newPayload) }\n\n' +
    'func newPayload(kind string) ast.Payload {\n' +
    groups
      .map(
        group =>
          'if value := ' +
          group +
          '.NewPayload(kind); value != nil { return value }'
      )
      .join('\n\n') +
    '\n\nreturn nil\n}\n'
  )
}
