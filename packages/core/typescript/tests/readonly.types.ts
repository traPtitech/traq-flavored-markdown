import { DocumentContext } from '../src/document.js'
import { defineNode } from '../src/nodes.js'
import type { Handler } from '../src/renderer/types.js'
import { DocumentSchema } from '../src/schema.js'

export function snapshotTypes(context: DocumentContext) {
  // @ts-expect-error snapshots expose readonly children
  context.document.children.push(context.document.children[0])
  // @ts-expect-error snapshots expose readonly spans
  context.document.children[0].span.start = 0
  const definition = defineNode<{
    kind: 'example'
    data: { values: string[] }
  }>('example', () => true)
  const node = context.document.children[0]
  if (definition.is(node)) {
    // @ts-expect-error narrowing preserves readonly payloads
    node.data.values.push('changed')
  }
}

export const payloadTypes: Handler<{
  kind: 'example'
  data: { values: string[] }
}> = node => {
  // @ts-expect-error handler payloads are deeply readonly
  node.data.values.push('changed')
  return ''
}

export function schemaTypes() {
  const text = defineNode<{ kind: 'text'; data: { value: string } }>(
    'text',
    () => true
  )
  const document = new DocumentSchema([text]).document({
    source: '',
    children: []
  })
  for (const node of document.walk()) {
    const value: string = node.data.value
    // @ts-expect-error a validated schema retains its exact node kind
    const other: 'other' = node.kind
    // @ts-expect-error typed traversal remains readonly
    node.data.value = value
    void other
  }
  const draft = document.toMutable()
  draft.children[0].data.value = 'editable'
  // @ts-expect-error Specific node unions require their validating schema.
  new DocumentContext<{ kind: 'text'; data: string }>({
    source: '',
    children: []
  })
  new DocumentContext<{ kind: 'text'; data: string }>(
    { source: '', children: [] },
    // @ts-expect-error Limits cannot replace a specific node union's schema.
    {}
  )
  // @ts-expect-error Open schemas must widen their node union through withUnknownNodes.
  new DocumentSchema([text], { unknown: 'preserve' })
  const open = new DocumentSchema([text]).withUnknownNodes().document({
    source: '',
    children: []
  })
  for (const node of open.walk()) {
    // @ts-expect-error Unknown nodes cannot claim the declared text payload.
    const value: string = node.data.value
    void value
  }
}
