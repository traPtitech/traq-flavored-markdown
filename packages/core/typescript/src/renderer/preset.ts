import type { NodeDefinition } from '../nodes.js'
import type { PluginGroup } from './definitions.js'
import type { Implementation, RenderPlugin } from './plugin.js'
import { implementation } from './plugin.js'
import type { Fallback, Handler, HtmlPreset } from './types.js'

const presets = new WeakMap<
  HtmlPreset,
  {
    handlers: Map<string, Handler>
    requiredContracts: Map<string, NodeDefinition>
    fallback: Fallback
  }
>()

const defaultFallback: Fallback = text => text

export function configuration(preset: HtmlPreset) {
  const value = presets.get(preset)

  if (!value) throw new TypeError('Expected HTML preset')

  return value
}

// Compare names only within selected declarations and their ancestor scopes.
function validateNames(plugins: Implementation[]) {
  const scopes = new Map<PluginGroup | null, Set<string>>()
  const groups = new Set<PluginGroup>()

  function add(parent: PluginGroup | null, name: string) {
    let names = scopes.get(parent)

    if (!names) scopes.set(parent, (names = new Set()))
    if (names.has(name)) throw new Error('Duplicate name: ' + name)

    names.add(name)
  }

  function group(value: PluginGroup | null) {
    if (!value || groups.has(value)) return

    group(value.parent)
    add(value.parent, value.name)

    groups.add(value)
  }

  for (const { declaration } of plugins) group(declaration.namespace)

  for (const { declaration } of plugins) {
    add(declaration.namespace, declaration.name)
  }
}

export class PresetBuilder {
  #plugins = new Map<RegistrationHandle, RenderPlugin>()

  #validate(plugin: RenderPlugin, replaced?: RegistrationHandle) {
    const state = implementation(plugin)

    for (const [handle, existing] of this.#plugins) {
      if (handle === replaced) continue
      const current = implementation(existing)
      if (current.declaration === state.declaration)
        throw new Error('Duplicate plugin')

      for (const kind of state.handlers.keys())
        if (current.handlers.has(kind))
          throw new Error('Duplicate handler: ' + kind)
    }
  }

  register(plugin: RenderPlugin): RegistrationHandle {
    this.#validate(plugin)
    const handle = Object.freeze({}) as RegistrationHandle
    this.#plugins.set(handle, plugin)
    return handle
  }

  add(plugin: RenderPlugin) {
    this.register(plugin)
    return this
  }

  remove(handle: RegistrationHandle) {
    if (!this.#plugins.delete(handle)) throw new Error('Missing registration')
    return this
  }

  replace(handle: RegistrationHandle, plugin: RenderPlugin) {
    if (!this.#plugins.has(handle)) throw new Error('Missing registration')
    this.#validate(plugin, handle)
    this.#plugins.set(handle, plugin)
    return this
  }

  build({ fallback = defaultFallback }: { fallback?: Fallback } = {}) {
    if (typeof fallback !== 'function')
      throw new TypeError('Expected render fallback')

    const plugins = [...this.#plugins.values()].map(implementation)
    validateNames(plugins)

    const preset = Object.freeze({}) as HtmlPreset

    presets.set(preset, {
      handlers: new Map(plugins.flatMap(p => [...p.handlers])),
      requiredContracts: new Map(
        plugins.flatMap(p => [...p.requiredContracts])
      ),
      fallback
    })

    return preset
  }
}

declare const registration: unique symbol
/** A durable registration in one builder, independent of plugin revisions. */
export interface RegistrationHandle {
  readonly [registration]: 'renderer-registration'
}
