import * as composition from './composition.js'
import { withDefaultAdapters } from '../profiles/defaults.js'
import type { Options } from '../profiles/traq.js'

export { endsWithResourceCard, resourceCardFromUrl } from './composition.js'
export type { ResourceCard, HtmlPlugins, Options } from './composition.js'

/** The standard traQ presentation with bundled highlighting and math adapters. */
export function htmlPreset(options?: Options) {
  return composition.htmlPreset(withDefaultAdapters(options))
}

export function html(options?: Options) {
  return composition.html(withDefaultAdapters(options))
}

export function messageRenderers({
  origin,
  ...options
}: Options & { origin: string }) {
  return composition.messageRenderers({
    origin,
    ...withDefaultAdapters(options)
  })
}
