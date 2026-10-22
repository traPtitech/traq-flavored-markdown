import type { DocumentContext } from '../document.js'
import type { Handler } from '../renderer/types.js'

export function snapshotTypes(context: DocumentContext) {
  // @ts-expect-error snapshots expose readonly children
  context.document.children.push(context.document.children[0])
  // @ts-expect-error snapshots expose readonly spans
  context.document.children[0].span.start = 0
}

export const payloadTypes: Handler<{ kind: 'example'; data: { values: string[] } }> = node => {
  // @ts-expect-error handler payloads are deeply readonly
  node.data.values.push('changed')
  return ''
}
