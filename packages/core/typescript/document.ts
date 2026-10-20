import type { Document, Node } from './ast.js'
import { defineNode, isOwnedDefinition, validateStructure } from './nodes.js'
import type { NodeDefinition, NodeStructure } from './nodes.js'
import { SourceText } from './source.js'

export interface DocumentLimits {
  sourceBytes: number
  payloadBytes: number
  nodes: number
  depth: number
}

export const documentLimits: Readonly<DocumentLimits> = Object.freeze({
  sourceBytes: 65_536,
  payloadBytes: 8 * 1024 * 1024,
  nodes: 16_384,
  depth: 64
})

export interface DocumentOptions {
  definitions?: Iterable<NodeDefinition>
  limits?: Readonly<DocumentLimits>
}

type Location = { readonly ancestors: readonly Node[]; readonly index: number }

/** Read JSON data without invoking caller-defined accessors. */
function dataField(value: object, key: string): unknown {
  const field = Object.getOwnPropertyDescriptor(value, key)
  if (field && !('value' in field))
    throw new TypeError('Document accessors are not supported')
  return field?.value
}

function plainRecord(value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new TypeError('Expected a JSON document object')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null)
    throw new TypeError('Expected a JSON document object')
  for (const key in value) if (Object.hasOwn(value, key)) dataField(value, key)
}

/** Count UTF-8 bytes without allocating a second copy of a large payload. */
function utf8Bytes(value: string): number {
  let bytes = 0
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i)
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i)
      if (!(next >= 0xdc00 && next <= 0xdfff))
        throw new TypeError('Document contains an unpaired surrogate')
      bytes += 4
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new TypeError('Document contains an unpaired surrogate')
    } else bytes += unit < 0x80 ? 1 : unit < 0x800 ? 2 : 3
  }
  return bytes
}

class PayloadSnapshot {
  #used = 0
  #active = new Set<object>()
  constructor(
    private readonly limit: number,
    private readonly depthLimit: number
  ) {}

  #charge(bytes: number): void {
    if (bytes > this.limit - this.#used)
      throw new RangeError('Document payload byte limit')
    this.#used += bytes
  }

  string(value: string): string {
    if (value.length > this.limit - this.#used)
      throw new RangeError('Document payload byte limit')
    this.#charge(utf8Bytes(value))
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
export class DocumentContext {
  readonly document: Document
  readonly source: SourceText
  #snapshots = new Map<Node, Node>()
  #locations = new Map<Node, Location>()
  #validated = new Set<NodeDefinition>()
  #structures = new Map<string, NodeStructure>()
  #validating = false

  constructor(
    document: Document,
    { definitions = [], limits = documentLimits }: DocumentOptions = {}
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
      utf8Bytes(source) > bound.sourceBytes
    )
      throw new RangeError('Render document source byte limit')
    this.source = new SourceText(source)
    if (!Array.isArray(children))
      throw new TypeError('Invalid render document children')
    const payloads = new PayloadSnapshot(bound.payloadBytes, bound.depth)
    let count = 0
    const visited = new Set<Node>()
    const copy = (
      nodes: Node[],
      start: number,
      end: number,
      ancestors: readonly Node[]
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
        const snapshot: Node = { kind, span: Object.freeze(span), data }
        this.#snapshots.set(node, snapshot)
        this.#snapshots.set(snapshot, snapshot)
        this.#locations.set(snapshot, Object.freeze({ ancestors, index }))
        if (children !== undefined)
          snapshot.children = copy(
            children,
            span.start,
            span.end,
            Object.freeze([...ancestors, snapshot])
          )
        result.push(Object.freeze(snapshot))
      }
      Object.freeze(result)
      return result
    }
    this.document = Object.freeze({
      source: this.source.text,
      children: copy(children, 0, this.source.byteLength, Object.freeze([]))
    })
    this.validateDefinitions(definitions)
    Object.freeze(this)
  }

  /** Resolve either a caller node or a snapshot node; external nodes are rejected. */
  node(value: Node): Node {
    const node = this.#snapshots.get(value)
    if (!node) throw new TypeError('Node does not belong to this document')
    return node
  }

  location(value: Node): Location {
    return this.#locations.get(this.node(value))!
  }

  /** Definitions are cached only after payload and structure validation succeeds. */
  validateDefinitions(definitions: Iterable<NodeDefinition>): void {
    if (this.#validating)
      throw new TypeError('Document validation is not reentrant')
    this.#validating = true
    try {
      this.#validateDefinitions(definitions)
    } finally {
      this.#validating = false
    }
  }

  #validateDefinitions(definitions: Iterable<NodeDefinition>): void {
    const pending = [...new Set(definitions)].filter(
      definition => !this.#validated.has(definition)
    )
    if (!pending.length) return
    const structures = new Map(this.#structures)
    const validators = new Map<string, ((data: unknown) => boolean)[]>()
    for (const definition of pending) {
      // Normalize even structurally typed declarations supplied by callers.
      const contract = defineNode(
        definition.kind,
        definition.validateData,
        definition.structure
      )
      const previous = structures.get(contract.kind)
      if (
        previous &&
        JSON.stringify(previous) !== JSON.stringify(contract.structure)
      )
        throw new TypeError('Conflicting node structure: ' + contract.kind)
      structures.set(contract.kind, contract.structure)
      const checks = validators.get(contract.kind) ?? []
      checks.push(contract.validateData)
      validators.set(contract.kind, checks)
    }
    for (const node of this.walk()) {
      if (validators.get(node.kind)?.some(validate => !validate(node.data)))
        throw new TypeError('Invalid render payload: ' + node.kind)
      validateStructure(node, structures)
    }
    this.#structures = structures
    for (const definition of pending)
      if (isOwnedDefinition(definition)) this.#validated.add(definition)
  }

  *walk(
    nodes: readonly Node[] = this.document.children,
    descend: (node: Node) => boolean = () => true
  ): Generator<Node> {
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
