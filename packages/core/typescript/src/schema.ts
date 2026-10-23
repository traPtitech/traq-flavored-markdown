import type { DeepReadonly, NodeVariant, ReadonlyDocument } from './ast.js'
import { DocumentContext } from './document.js'
import type { DocumentLimits } from './document.js'
import { DocumentValidationError } from './errors.js'
import { defineNode, isOwnedDefinition, validateStructure } from './nodes.js'
import type { NodeDefinition, NodeStructure } from './nodes.js'

/** Immutable node contracts, selected independently from render handlers. */
export class DocumentSchema<Variant extends NodeVariant = NodeVariant> {
  readonly #definitions: ReadonlyMap<string, NodeDefinition>
  readonly #structures: ReadonlyMap<string, NodeStructure>
  #unknown: 'preserve' | 'reject' = 'reject'

  constructor(definitions: Iterable<NodeDefinition<Variant>> = []) {
    const contracts = new Map<string, NodeDefinition>()
    const structures = new Map<string, NodeStructure>()
    for (const input of definitions) {
      const definition = isOwnedDefinition(input)
        ? input
        : defineNode(input.kind, input.validateData, input.structure)
      const previous = contracts.get(definition.kind)
      if (previous && previous !== definition)
        throw new DocumentValidationError(
          'Duplicate node contract: ' + definition.kind
        )
      contracts.set(definition.kind, definition)
      structures.set(definition.kind, definition.structure)
    }
    this.#definitions = contracts
    this.#structures = structures
    Object.freeze(this)
  }

  has(kind: string): boolean {
    return this.#definitions.has(kind)
  }

  hasDefinition(definition: NodeDefinition): boolean {
    return this.#definitions.get(definition.kind) === definition
  }

  /** Payload guard for external nodes; owned documents use their preserved union. */
  isKnownNode<T extends NodeVariant>(
    node: T
  ): node is T & DeepReadonly<Variant> {
    return this.#definitions.get(node.kind)?.validateData(node.data) ?? false
  }

  /** Add application contracts without changing the original schema. */
  extend<Additional extends NodeVariant>(
    definitions: Iterable<NodeDefinition<Additional>>
  ): DocumentSchema<Variant | Additional> {
    const extended = new DocumentSchema<Variant | Additional>([
      ...this.#definitions.values(),
      ...definitions
    ] as NodeDefinition<Variant | Additional>[])
    extended.#unknown = this.#unknown
    return extended
  }

  /** Preserve opaque application nodes while still checking every known contract. */
  withUnknownNodes(): DocumentSchema<NodeVariant> {
    const open = new DocumentSchema(this.#definitions.values())
    open.#unknown = 'preserve'
    return open
  }

  /** Validate and own external input, or reuse an already owned document. */
  document(
    input: ReadonlyDocument | DocumentContext,
    options: { limits?: Readonly<DocumentLimits> } = {}
  ): DocumentContext<Variant> {
    if (input instanceof DocumentContext && options.limits === undefined)
      return input.withSchema(this)
    return new DocumentContext(
      input instanceof DocumentContext ? input.document : input,
      { ...options, schema: this }
    )
  }

  /** Whether this schema's guarantees already imply the requested contracts. */
  satisfies(other: DocumentSchema): boolean {
    if (this === other) return true
    if (other.#unknown === 'reject') return false
    for (const [kind, definition] of other.#definitions)
      if (this.#definitions.get(kind) !== definition) return false
    return true
  }

  assertCompatible(other: DocumentSchema): void {
    for (const [kind, definition] of this.#definitions) {
      const previous = other.#definitions.get(kind)
      if (
        previous &&
        JSON.stringify(previous.structure) !==
          JSON.stringify(definition.structure)
      )
        throw new DocumentValidationError('Conflicting node structure: ' + kind)
    }
  }

  /** Called only after the document has been snapshotted and source-checked. */
  validate(context: DocumentContext): void {
    for (const node of context.walk()) {
      const definition = this.#definitions.get(node.kind)
      const path = context.location(node).path
      if (!definition) {
        if (this.#unknown === 'reject')
          throw new DocumentValidationError('Unknown node kind: ' + node.kind, {
            path
          })
        continue
      }
      try {
        if (!definition.validateData(node.data))
          throw new DocumentValidationError(
            'Invalid node payload: ' + node.kind,
            {
              path: path + '.data'
            }
          )
        validateStructure(node, this.#structures)
      } catch (cause) {
        if (cause instanceof DocumentValidationError) throw cause
        throw new DocumentValidationError(
          cause instanceof Error
            ? cause.message
            : 'Invalid node structure: ' + node.kind,
          { path, cause }
        )
      }
    }
  }
}

/** Grammar-independent snapshots accept opaque nodes without assigning payload types. */
export const opaqueDocumentSchema = new DocumentSchema().withUnknownNodes()
