import type { DocumentContext } from '../src/document.js'
import { defineNode } from '../src/nodes.js'
import type { Handler } from '../src/renderer/types.js'

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
