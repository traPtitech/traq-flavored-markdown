import {
  block,
  lines,
  sections,
  sourceFile
} from '../../../../tools/contracts/emitters/source.ts'
import { nodeGroup } from '../../../../tools/contracts/model/groups.ts'

export function goNodes(manifest: {
  nodes: Record<string, { group: string }>
}) {
  const groups = [
    ...new Set(Object.values(manifest.nodes).map(node => node.group))
  ]

  for (const group of groups) nodeGroup(group)

  return sourceFile(
    lines(
      '// Code generated from Rust contract ownership. DO NOT EDIT.',
      'package markdown'
    ),
    block(
      'import (',
      lines(
        '"github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"',
        groups.map(
          group =>
            `${group} "github.com/traPtitech/traq-flavored-markdown/packages/${nodeGroup(group).goPackage}"`
        )
      ),
      ')'
    ),
    lines(
      'type Document = ast.Document',
      'type Node = ast.Node',
      'type MutableDocument = ast.MutableDocument',
      'type MutableNode = ast.MutableNode',
      'type Span = ast.Span',
      'type Payload = ast.Payload'
    ),
    'func DecodeDocument(raw []byte) (*Document,error) { return ast.DecodeDocument(raw, newPayload) }',
    'func NewDocument(document *MutableDocument) (*Document,error) { return ast.NewDocument(document, newPayload) }',
    block(
      'func newPayload(kind string) ast.Payload {',
      sections(
        groups.map(group =>
          block(
            `if value := ${group}.NewPayload(kind); value != nil {`,
            'return value'
          )
        ),
        'return nil'
      )
    )
  )
}
