import type { Node } from '../ast.js'
import type { NodeDefinition } from '../nodes.js'
import { defineNode, isOwnedDefinition } from '../nodes.js'
import { PluginDeclaration } from './definitions.js'
import type { Handler, RenderContext } from './types.js'

type NodeFor<D> = D extends NodeDefinition<infer K> ? Node & K : Node
type DefinedHandler<D> = (node: NodeFor<D>, context: RenderContext) => string

export interface Implementation {
  declaration: PluginDeclaration
  handlers: ReadonlyMap<string, Handler>
  definitions: ReadonlyMap<string, NodeDefinition>
}

const implementations = new WeakMap<RenderPlugin, Implementation>()

export function implementation(plugin: RenderPlugin) {
  const value = implementations.get(plugin)
  if (!value) throw new TypeError('Expected RenderPlugin')
  return value
}

export class RenderPlugin {
  constructor(declaration: PluginDeclaration) {
    if (!(declaration instanceof PluginDeclaration))
      throw new TypeError('Expected RenderPlugin declaration')

    implementations.set(this, {
      declaration,
      handlers: new Map(),
      definitions: new Map()
    })
    Object.freeze(this)
  }

  on<D extends string | NodeDefinition>(
    definition: D,
    handler: DefinedHandler<D>
  ) {
    return this.#set(definition, handler, false)
  }

  replace<D extends string | NodeDefinition>(
    definition: D,
    handler: DefinedHandler<D>
  ) {
    return this.#set(definition, handler, true)
  }

  #set<D extends string | NodeDefinition>(
    definition: D,
    handler: DefinedHandler<D>,
    replacing: boolean
  ) {
    const kind = typeof definition === 'string' ? definition : definition?.kind
    const validateData =
      typeof definition === 'string' ? undefined : definition?.validateData
    const structure =
      typeof definition === 'string' ? undefined : definition?.structure
    if (typeof kind !== 'string' || typeof handler !== 'function')
      throw new TypeError('Expected node kind and render handler')
    if (typeof definition !== 'string' && typeof validateData !== 'function')
      throw new TypeError('Expected node payload validator')

    const state = implementation(this)

    if (state.handlers.has(kind) !== replacing) {
      throw new Error(
        (replacing ? 'Missing' : 'Duplicate') + ' handler: ' + kind
      )
    }

    const handlers = new Map(state.handlers)
    handlers.set(kind, (node, context) => handler(node as NodeFor<D>, context))
    const definitions = new Map(state.definitions)
    if (typeof definition !== 'string')
      definitions.set(
        kind,
        isOwnedDefinition(definition)
          ? definition
          : defineNode(kind, validateData!, structure)
      )

    const next = new RenderPlugin(state.declaration)
    implementations.set(next, {
      declaration: state.declaration,
      handlers,
      definitions
    })
    return next
  }
}
