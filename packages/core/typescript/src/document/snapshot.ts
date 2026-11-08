import type {
  ReadonlyDocument as Document,
  MutableNode,
  ReadonlyNode as Node,
  NodeVariant
} from '../ast.js'
import { dataField, utf8ByteLength } from '../boundary.js'
import { JsonBoundaryError, JsonSnapshot } from '../bounded-json.js'
import type { DocumentLimits } from '../document.js'
import { DocumentValidationError } from '../errors.js'
import { SourceText } from '../source.js'

export type Location<Variant extends NodeVariant = NodeVariant> = {
  readonly ancestors: readonly Node<Variant>[]
  readonly index: number
  readonly path: string
}

function plainRecord(
  value: unknown,
  path: string,
  fields: readonly string[]
): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DocumentValidationError('Expected a JSON document object', {
      path
    })
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new DocumentValidationError('Expected a JSON document object', {
      path
    })
  }

  for (const key in value) {
    if (!Object.hasOwn(value, key)) continue

    if (!fields.includes(key)) {
      throw new DocumentValidationError(
        'Unexpected document property: ' + key.slice(0, 80),
        { path }
      )
    }

    documentField(value, key, path)
  }
}

function documentField(value: object, key: string, path = '$'): unknown {
  try {
    return dataField(value, key)
  } catch (cause) {
    throw new DocumentValidationError('JSON accessors are not supported', {
      path: path + '.' + key,
      cause
    })
  }
}

function payloadFailure(cause: unknown): never {
  if (!(cause instanceof JsonBoundaryError)) throw cause

  const resource =
    cause.reason === 'bytes'
      ? 'payload_bytes'
      : cause.reason === 'depth'
        ? 'payload_depth'
        : cause.reason === 'values'
          ? 'payload_values'
          : undefined

  const message =
    cause.reason === 'bytes'
      ? 'Document payload byte limit exceeded'
      : cause.message

  throw new DocumentValidationError(message, {
    path: cause.path,
    resource,
    cause
  })
}

export function snapshotDocument(
  document: Document,
  limits: Readonly<DocumentLimits>
) {
  const snapshots = new WeakMap<Node, Node>()
  const locations = new Map<Node, Location>()

  plainRecord(limits, '$.limits', [
    'sourceBytes',
    'payloadBytes',
    'nodes',
    'depth'
  ])

  const bound = Object.fromEntries(
    ['sourceBytes', 'payloadBytes', 'nodes', 'depth'].map(name => {
      const value = documentField(limits, name, '$.limits')
      if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < 0
      ) {
        throw new DocumentValidationError(
          'Document limits must be finite nonnegative integers',
          { path: '$.limits.' + name }
        )
      }

      return [name, value]
    })
  ) as unknown as DocumentLimits

  plainRecord(document, '$', ['source', 'children'])
  const source = documentField(document, 'source')
  const children = documentField(document, 'children')

  if (typeof source !== 'string') {
    throw new DocumentValidationError('Invalid document source', {
      path: '$.source'
    })
  }

  try {
    if (
      source.length > bound.sourceBytes ||
      utf8ByteLength(source) > bound.sourceBytes
    ) {
      throw new DocumentValidationError('Document source byte limit', {
        path: '$.source',
        resource: 'source_bytes'
      })
    }
  } catch (cause) {
    if (cause instanceof DocumentValidationError) throw cause

    throw new DocumentValidationError('Text contains an unpaired surrogate', {
      path: '$.source',
      cause
    })
  }

  const sourceText = new SourceText(source)

  if (!Array.isArray(children)) {
    throw new DocumentValidationError('Invalid document children', {
      path: '$.children'
    })
  }

  const payloads = new JsonSnapshot({
    bytes: bound.payloadBytes,
    depth: bound.depth
  })

  let count = 0
  const visited = new Set<Node>()

  const copy = (
    nodes: readonly Node[],
    start: number,
    end: number,
    ancestors: readonly Node[],
    parentPath: string
  ): Node[] => {
    const length = nodes.length
    if (ancestors.length >= bound.depth && length) {
      throw new DocumentValidationError('Document depth limit', {
        path: parentPath,
        resource: 'depth'
      })
    }

    if (length > bound.nodes - count) {
      throw new DocumentValidationError('Document node limit', {
        path: parentPath,
        resource: 'nodes'
      })
    }

    count += length
    let previousEnd = start
    const result: Node[] = []

    for (let index = 0; index < length; index++) {
      const path = `${parentPath}.children[${index}]`

      const node = documentField(
        nodes,
        String(index),
        parentPath + '.children'
      ) as Node

      plainRecord(node, path, ['kind', 'span', 'data', 'children'])
      const kind = documentField(node, 'kind', path)
      const originalSpan = documentField(node, 'span', path)
      if (
        typeof kind !== 'string' ||
        !Object.hasOwn(node, 'data') ||
        !originalSpan
      ) {
        throw new DocumentValidationError('Invalid document node', { path })
      }

      plainRecord(originalSpan, path + '.span', ['start', 'end'])

      const span = {
        start: documentField(originalSpan, 'start', path + '.span') as number,
        end: documentField(originalSpan, 'end', path + '.span') as number
      }
      if (
        typeof span.start !== 'number' ||
        typeof span.end !== 'number' ||
        span.start < previousEnd ||
        span.end < span.start ||
        span.end > end ||
        !sourceText.isBoundary(span.start) ||
        !sourceText.isBoundary(span.end)
      ) {
        throw new DocumentValidationError('Invalid document span', {
          path: path + '.span'
        })
      }

      if (visited.has(node)) {
        throw new DocumentValidationError('Document nodes must form a tree', {
          path
        })
      }

      visited.add(node)
      previousEnd = span.end
      const children = documentField(node, 'children', path)
      if (children !== undefined && !Array.isArray(children)) {
        throw new DocumentValidationError('Invalid document children', {
          path: path + '.children'
        })
      }

      let data: unknown

      try {
        payloads.string(kind, path + '.kind')

        data = payloads.snapshot(
          documentField(node, 'data', path),
          path + '.data'
        )
      } catch (cause) {
        payloadFailure(cause)
      }

      const snapshot: MutableNode = { kind, span: Object.freeze(span), data }
      snapshots.set(node, snapshot)
      snapshots.set(snapshot, snapshot)
      locations.set(snapshot, Object.freeze({ ancestors, index, path }))

      if (children !== undefined) {
        Object.defineProperty(snapshot, 'children', {
          value: copy(
            children,
            span.start,
            span.end,
            Object.freeze([...ancestors, snapshot]),
            path
          ),
          enumerable: true
        })
      }

      result.push(Object.freeze(snapshot))
    }

    Object.freeze(result)
    return result
  }

  const ownedDocument = Object.freeze({
    source: sourceText.text,
    children: copy(children, 0, sourceText.byteLength, Object.freeze([]), '$')
  })

  return { document: ownedDocument, source: sourceText, snapshots, locations }
}
