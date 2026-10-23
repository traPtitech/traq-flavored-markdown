import type {
  ReadonlyDocument as Document,
  Node as MutableNode,
  ReadonlyNode as Node,
  NodeVariant,
  MutableDocument
} from './ast.js'
import { ByteBudget, dataField, utf8ByteLength } from './boundary.js'
import { documentLimits } from './generated/limits.js'
import { DocumentValidationError } from './errors.js'
import { DocumentSchema, opaqueDocumentSchema } from './schema.js'
import type { NodeDefinition } from './nodes.js'
import { SourceText } from './source.js'

export { documentLimits } from './generated/limits.js'

export interface DocumentLimits {
  sourceBytes: number
  payloadBytes: number
  nodes: number
  depth: number
}

export interface DocumentOptions<Variant extends NodeVariant = NodeVariant> {
  schema?: DocumentSchema<Variant>
  limits?: Readonly<DocumentLimits>
}

type Location<Variant extends NodeVariant = NodeVariant> = {
  readonly ancestors: readonly Node<Variant>[]
  readonly index: number
  readonly path: string
}

function plainRecord(value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new TypeError('Expected a JSON document object')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null)
    throw new TypeError('Expected a JSON document object')
  for (const key in value) if (Object.hasOwn(value, key)) dataField(value, key)
}

class PayloadSnapshot {
  #budget: ByteBudget
  #active = new Set<object>()
  constructor(
    limit: number,
    private readonly depthLimit: number
  ) {
    this.#budget = new ByteBudget(
      limit,
      () => new RangeError('Document payload byte limit')
    )
  }

  #charge(bytes: number): void {
    this.#budget.reserve(bytes)
  }

  string(value: string): string {
    if (value.length > this.#budget.remaining)
      throw new RangeError('Document payload byte limit')
    this.#charge(utf8ByteLength(value))
    return value
  }

  copy(value: unknown, depth = 0): unknown {
    if (depth > this.depthLimit)
      throw new RangeError('Document payload depth limit')
    this.#charge(1)
    if (typeof value === 'string') return this.string(value)
    if (
      value === null ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    )
      return value
    if (typeof value !== 'object' || this.#active.has(value))
      throw new TypeError('Expected JSON node payload')
    this.#active.add(value)
    try {
      if (Array.isArray(value)) {
        // Bound the array before allocating or inspecting all of its elements.
        this.#charge(value.length)
        for (const key in value)
          if (Object.hasOwn(value, key)) dataField(value, key)
        const copy: unknown[] = []
        for (let i = 0; i < value.length; i++)
          copy.push(this.copy(dataField(value, String(i)), depth + 1))
        return Object.freeze(copy)
      }
      plainRecord(value)
      const copy: Record<string, unknown> = {}
      for (const key in value) {
        if (!Object.hasOwn(value, key)) continue
        this.string(key)
        Object.defineProperty(copy, key, {
          value: this.copy(dataField(value, key), depth + 1),
          enumerable: true
        })
      }
      return Object.freeze(copy)
    } finally {
      this.#active.delete(value)
    }
  }
}

/** A validated, owned snapshot for one or more document operations.
 * The caller's mutable AST is never frozen or used as an unbounded validation cache.
 */
export class DocumentContext<Variant extends NodeVariant = NodeVariant> {
  readonly document: Document<Variant>
  readonly source: SourceText
  #snapshots = new Map<Node, Node>()
  #locations = new Map<Node, Location>()
  #validated = new Set<DocumentSchema>()
  #validating = false

  constructor(
    document: Document,
    {
      schema = opaqueDocumentSchema as DocumentSchema<Variant>,
      limits = documentLimits
    }: DocumentOptions<Variant> = {}
  ) {
    plainRecord(limits)
    const bound = Object.fromEntries(
      ['sourceBytes', 'payloadBytes', 'nodes', 'depth'].map(name => {
        const value = dataField(limits, name)
        if (
          typeof value !== 'number' ||
          !Number.isSafeInteger(value) ||
          value < 0
        )
          throw new RangeError(
            'Document limits must be finite nonnegative integers'
          )
        return [name, value]
      })
    ) as unknown as DocumentLimits
    plainRecord(document)
    const source = dataField(document, 'source')
    const children = dataField(document, 'children')
    if (typeof source !== 'string')
      throw new TypeError('Invalid render document source')
    if (
      source.length > bound.sourceBytes ||
      utf8ByteLength(source) > bound.sourceBytes
    )
      throw new RangeError('Render document source byte limit')
    this.source = new SourceText(source)
    if (!Array.isArray(children))
      throw new TypeError('Invalid render document children')
    const payloads = new PayloadSnapshot(bound.payloadBytes, bound.depth)
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
      if (ancestors.length >= bound.depth && length)
        throw new RangeError('Render document depth limit')
      if (length > bound.nodes - count)
        throw new RangeError('Render document node limit')
      count += length
      let previousEnd = start
      const result: Node[] = []
      for (let index = 0; index < length; index++) {
        const node = dataField(nodes, String(index)) as Node
        plainRecord(node)
        const kind = dataField(node, 'kind')
        const originalSpan = dataField(node, 'span')
        if (
          typeof kind !== 'string' ||
          !Object.hasOwn(node, 'data') ||
          !originalSpan
        )
          throw new TypeError('Invalid render document span')
        plainRecord(originalSpan)
        const span = {
          start: dataField(originalSpan, 'start') as number,
          end: dataField(originalSpan, 'end') as number
        }
        if (
          typeof span.start !== 'number' ||
          typeof span.end !== 'number' ||
          span.start < previousEnd ||
          span.end < span.start ||
          span.end > end ||
          !this.source.isBoundary(span.start) ||
          !this.source.isBoundary(span.end)
        )
          throw new TypeError('Invalid render document span')
        if (visited.has(node))
          throw new TypeError('Document nodes must form a tree')
        visited.add(node)
        previousEnd = span.end
        const children = dataField(node, 'children')
        if (children !== undefined && !Array.isArray(children))
          throw new TypeError('Invalid render document children')
        payloads.string(kind)
        const data = payloads.copy(dataField(node, 'data'))
        const snapshot: MutableNode = { kind, span: Object.freeze(span), data }
        this.#snapshots.set(node, snapshot)
        this.#snapshots.set(snapshot, snapshot)
        const path = `${parentPath}.children[${index}]`
        this.#locations.set(snapshot, Object.freeze({ ancestors, index, path }))
        if (children !== undefined)
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
        result.push(Object.freeze(snapshot))
      }
      Object.freeze(result)
      return result
    }
    this.document = Object.freeze({
      source: this.source.text,
      children: copy(children, 0, this.source.byteLength, Object.freeze([]), '$')
    }) as unknown as Document<Variant>
    this.withSchema(schema)
    Object.freeze(this)
  }

  /** Resolve either a caller node or a snapshot node; external nodes are rejected. */
  node(value: Node): Node<Variant> {
    const node = this.#snapshots.get(value)
    if (!node) throw new TypeError('Node does not belong to this document')
    return node as Node<Variant>
  }

  location(value: Node): Location<Variant> {
    return this.#locations.get(this.node(value))! as Location<Variant>
  }

  hasContract(kind: string): boolean {
    return [...this.#validated].some(schema => schema.has(kind))
  }

  /** Narrow owned, validated data without running its payload validator again. */
  matches<Selected extends NodeVariant>(
    node: Node,
    definition: NodeDefinition<Selected>
  ): node is Node & Node<Selected> {
    this.node(node)
    if (![...this.#validated].some(schema => schema.hasDefinition(definition)))
      throw new DocumentValidationError('Node contract has not been validated: ' + definition.kind)
    return node.kind === definition.kind
  }

  /** Reuse ownership while checking an independently selected node schema. */
  withSchema<Selected extends NodeVariant>(
    schema: DocumentSchema<Selected>
  ): DocumentContext<Selected> {
    if ([...this.#validated].some(previous => previous.satisfies(schema)))
      return this as unknown as DocumentContext<Selected>
    if (this.#validating)
      throw new DocumentValidationError('Document validation is not reentrant')
    for (const previous of this.#validated) schema.assertCompatible(previous)
    this.#validating = true
    try {
      schema.validate(this)
      this.#validated.add(schema)
    } finally {
      this.#validating = false
    }
    return this as unknown as DocumentContext<Selected>
  }

  /** Explicit editing boundary: the returned draft shares no mutable data. */
  toMutable(): MutableDocument<Variant> {
    return structuredClone(this.document) as unknown as MutableDocument<Variant>
  }

  *walk(
    nodes: readonly Node<Variant>[] = this.document.children,
    descend: (node: Node<Variant>) => boolean = () => true
  ): Generator<Node<Variant>> {
    const pending = [...nodes].reverse()
    while (pending.length) {
      const node = this.node(pending.pop()!)
      yield node
      if (node.children && descend(node))
        for (let i = node.children.length - 1; i >= 0; i--)
          pending.push(node.children[i])
    }
  }
}
