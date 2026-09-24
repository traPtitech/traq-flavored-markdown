import type { Document, Node } from '../ast.js'

const limits = { sourceBytes: 65_536, nodes: 16_384, depth: 64 }

/** Validate source ranges before a handler or fallback can consume the tree. */
export function documentBytes(document: Document): Uint8Array {
  if (typeof document?.source !== 'string')
    throw new TypeError('Invalid render document source')
  if (document.source.length > limits.sourceBytes)
    throw new RangeError('Render document source byte limit')
  const bytes = new TextEncoder().encode(document.source)
  if (bytes.length > limits.sourceBytes)
    throw new RangeError('Render document source byte limit')
  if (!Array.isArray(document.children))
    throw new TypeError('Invalid render document children')

  type Group = {
    nodes: readonly Node[]
    start: number
    end: number
    depth: number
  }
  const groups: Group[] = [
    { nodes: document.children, start: 0, end: bytes.length, depth: 1 }
  ]
  let count = 0
  const boundary = (index: number) =>
    index === bytes.length || (bytes[index] & 0xc0) !== 0x80

  while (groups.length) {
    const group = groups.pop()!
    if (group.depth > limits.depth)
      throw new RangeError('Render document depth limit')
    if (group.nodes.length > limits.nodes - count)
      throw new RangeError('Render document node limit')
    count += group.nodes.length
    let previousEnd = group.start
    for (const node of group.nodes) {
      const span = node?.span
      if (
        typeof node?.kind !== 'string' ||
        !span ||
        !Number.isSafeInteger(span.start) ||
        !Number.isSafeInteger(span.end) ||
        span.start < previousEnd ||
        span.end < span.start ||
        span.end > group.end ||
        !boundary(span.start) ||
        !boundary(span.end)
      )
        throw new TypeError('Invalid render document span')
      previousEnd = span.end
      if (node.children !== undefined) {
        if (!Array.isArray(node.children))
          throw new TypeError('Invalid render document children')
        if (node.children.length)
          groups.push({
            nodes: node.children,
            start: span.start,
            end: span.end,
            depth: group.depth + 1
          })
      }
    }
  }
  return bytes
}
