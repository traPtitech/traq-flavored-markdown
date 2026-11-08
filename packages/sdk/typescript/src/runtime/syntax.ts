import type {
  DeepReadonly,
  ReadonlyNode,
  Span
} from '@traq-flavored-markdown/core'
import { utf8ByteLength } from '@traq-flavored-markdown/core/validation'

import { isSyntaxRecords } from '../generated/processing.js'
import type {
  SourceSyntax,
  SyntaxMarker,
  SyntaxSpan
} from '../generated/processing.js'
import type { ParsedDocument } from './types.js'

export interface ParsedSyntax {
  readonly document: ParsedDocument
  readonly syntax: DeepReadonly<SyntaxTree>
  syntaxFor(node: ReadonlyNode): DeepReadonly<NodeSyntax>
}

export interface NodeSyntax {
  readonly source: DeepReadonly<SourceSyntax> | null
  readonly children: readonly NodeSyntax[]
}

export interface SyntaxTree {
  readonly children: readonly NodeSyntax[]
  readonly detached: readonly DeepReadonly<SyntaxMarker>[]
}

/** Bind source facts to the owned snapshot before returning a transport result. */
export function bindSyntax(
  document: ParsedDocument,
  input: unknown
): ParsedSyntax {
  if (!isSyntaxRecords(input)) throw new TypeError('Invalid syntax response')

  const owned = new WeakMap<ReadonlyNode, DeepReadonly<NodeSyntax>>()
  const source = document.source

  const fail = (): never => {
    throw new TypeError('Invalid syntax response')
  }

  const span = (input: SyntaxSpan): Readonly<Span> => {
    source.assertSpan(input)
    return Object.freeze({ start: input.start, end: input.end })
  }

  const marker = (input: SyntaxMarker): DeepReadonly<SyntaxMarker> => {
    const columns = input.columns ?? undefined
    const text = input.text ?? undefined

    if (columns !== undefined && columns > source.byteLength * 4 + 4) {
      return fail()
    }

    if (text !== undefined && utf8ByteLength(text) > source.byteLength * 4) {
      return fail()
    }

    return Object.freeze({
      kind: input.kind,
      spans: Object.freeze(input.spans.map(span)),
      ...(columns === undefined ? {} : { columns }),
      ...(text === undefined ? {} : { text })
    })
  }

  const facts = (
    input: SourceSyntax | null | undefined
  ): DeepReadonly<SourceSyntax> | null => {
    if (input === undefined) return fail()
    if (input === null) return null

    return Object.freeze({
      content: Object.freeze(input.content.map(span)),
      markers: Object.freeze(input.markers.map(marker))
    })
  }

  const records = input.nodes
  let index = 0

  const children = (nodes: readonly ReadonlyNode[]): readonly NodeSyntax[] => {
    return Object.freeze(
      nodes.map(node => {
        const source = facts(records[index++])

        const syntax = Object.freeze({
          source,
          children: children(node.children ?? [])
        })

        owned.set(node, syntax)
        return syntax
      })
    )
  }

  const syntax = Object.freeze({
    children: children(document.document.children),
    detached: Object.freeze(input.detached.map(marker))
  })

  if (index !== records.length) return fail()

  return Object.freeze({
    document,
    syntax,

    syntaxFor(node: ReadonlyNode) {
      return owned.get(document.node(node))!
    }
  })
}
