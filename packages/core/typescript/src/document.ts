import type {
  ReadonlyDocument as Document,
  MutableDocument,
  ReadonlyNode as Node,
  NodeVariant
} from './ast.js'
import { type Location, snapshotDocument } from './document/snapshot.js'
import { DocumentValidationError } from './errors.js'
import { documentLimits } from './generated/limits.js'
import type { NodeDefinition } from './nodes.js'
import { opaqueDocumentSchema } from './schema.js'
import type { DocumentSchema } from './schema.js'
import type { SourceText } from './source.js'

export { documentLimits } from './generated/limits.js'

export interface DocumentLimits {
  sourceBytes: number
  payloadBytes: number
  nodes: number
  depth: number
}

export interface DocumentOptions<Variant extends NodeVariant = NodeVariant> {
  schema?: DocumentSchema<Variant> | undefined
  limits?: Readonly<DocumentLimits> | undefined
}

/** A validated, owned snapshot for one or more document operations.
 * The caller's mutable AST is never frozen or used as an unbounded validation cache.
 */
export class DocumentContext<Variant extends NodeVariant = NodeVariant> {
  readonly document: Document<Variant>
  readonly source: SourceText
  #snapshots: WeakMap<Node, Node>
  #locations: Map<Node, Location>
  #validated = new Set<DocumentSchema>()
  #validating = false

  constructor(
    document: Document,
    options: DocumentOptions<Variant> & { schema: DocumentSchema<Variant> }
  )

  constructor(
    document: Document,
    ...options: NodeVariant extends Variant
      ? [options?: Omit<DocumentOptions<Variant>, 'schema'>]
      : never
  )

  constructor(
    document: Document,
    {
      schema = opaqueDocumentSchema as DocumentSchema<Variant>,
      limits = documentLimits
    }: DocumentOptions<Variant> = {}
  ) {
    const owned = snapshotDocument(document, limits)
    this.document = owned.document as unknown as Document<Variant>
    this.source = owned.source
    this.#snapshots = owned.snapshots
    this.#locations = owned.locations

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

  hasDefinition(definition: NodeDefinition): boolean {
    return [...this.#validated].some(schema => schema.hasDefinition(definition))
  }

  /** Narrow owned, validated data without running its payload validator again. */
  matches<Selected extends NodeVariant>(
    node: Node,
    definition: NodeDefinition<Selected>
  ): node is Node & Node<Selected> {
    if (this.node(node) !== node) {
      throw new DocumentValidationError(
        'Only owned snapshot nodes can be narrowed'
      )
    }

    if (
      ![...this.#validated].some(schema => schema.hasDefinition(definition))
    ) {
      throw new DocumentValidationError(
        'Node contract has not been validated: ' + definition.kind
      )
    }

    return node.kind === definition.kind
  }

  /** Reuse ownership while checking an independently selected node schema. */
  withSchema<Selected extends NodeVariant>(
    schema: DocumentSchema<Selected>
  ): DocumentContext<Selected> {
    if ([...this.#validated].some(previous => previous.satisfies(schema))) {
      return this as unknown as DocumentContext<Selected>
    }

    if (this.#validating) {
      throw new DocumentValidationError('Document validation is not reentrant')
    }

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

      if (node.children && descend(node)) {
        for (let i = node.children.length - 1; i >= 0; i--) {
          pending.push(node.children[i]!)
        }
      }
    }
  }
}
