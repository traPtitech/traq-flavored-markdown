import { plugin as common } from '@traq-flavored-markdown/commonmark-plugin/renderer'
import type { DocumentContext } from '@traq-flavored-markdown/core'
import { PresetBuilder } from '@traq-flavored-markdown/core/renderer'
import type { Document } from '@traq-flavored-markdown/core/renderer'
import { renderer } from '@traq-flavored-markdown/core/renderer'
import { plugin as extensions } from '@traq-flavored-markdown/extensions-plugin/renderer'
import { plugin as trap } from '@traq-flavored-markdown/traq-plugin/renderer'

import { analyzeMessage, messageContext } from '../messages/analysis.js'
import { normalizeTraqOrigin } from '../messages/cards.js'
import { resolveOptions } from '../profiles/traq.js'
import type { Options, ResolvedOptions } from '../profiles/traq.js'
import { configureCondensed } from './condensed.js'
import { configureSpacing } from './spacing.js'

export { endsWithResourceCard } from '../messages/analysis.js'
export { resourceCardFromUrl } from '../messages/cards.js'
export type { ResourceCard } from '../messages/cards.js'
export type { HtmlPlugins, Options } from '../profiles/traq.js'

function buildPreset(
  { plugins = [], configurePlugins, ...options }: ResolvedOptions,
  condensed = false
) {
  const commonPlugin = configureSpacing(common(options), options.xhtmlOut)

  const extensionsPlugin = extensions({
    math: condensed ? options.condensedMath : options.math
  })
  const trapPlugin = trap(options)
  const defaults = condensed
    ? configureCondensed(commonPlugin, extensionsPlugin, trapPlugin, options)
    : {
        common: commonPlugin,
        extensions: extensionsPlugin,
        traq: trapPlugin
      }
  const selected = configurePlugins?.(defaults) ?? defaults

  const builder = new PresetBuilder()
    .add(selected.common)
    .add(selected.extensions)
    .add(selected.traq)
  for (const plugin of plugins) builder.add(plugin)
  return builder.build()
}

/** Compose the standard HTML handlers with optional third-party plugins. */
export function htmlPreset(options?: Options) {
  return buildPreset(resolveOptions(options))
}

/** Create a renderer with the standard HTML handlers. */
export function html(options?: Options) {
  return renderer(htmlPreset(options))
}

/** Build standard and condensed message renderers from the same options. */
export function messageRenderers({
  origin,
  ...options
}: Options & { origin: string }) {
  const parsedOrigin = new URL(origin)
  if (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:')
    throw new TypeError('Expected an HTTP(S) origin')
  const cardOrigin = normalizeTraqOrigin(origin)
  const resolvedOptions = resolveOptions(options)

  const standardView = renderer(buildPreset(resolvedOptions))
  const condensedView = renderer(buildPreset(resolvedOptions, true))

  function prepare(document: Document | DocumentContext) {
    const standard = standardView.createSession(document)
    const context = messageContext(standard.context)
    const condensed = condensedView.createSession(context)
    const analysis = analyzeMessage(
      context,
      cardOrigin,
      resolvedOptions.validateLink
    )
    const render = (compact: boolean) => ({
      rawText: context.source.text,
      html: (compact ? condensed : standard).render({
        roots: analysis.roots,
        omittedNodes: analysis.omittedNodes,
        childText: compact ? analysis.childText : undefined,
        rootSeparator: compact ? ' ' : ''
      }),
      cards: analysis.cards.map(card => ({ ...card }))
    })
    return Object.freeze({
      context,
      standard: () => render(false),
      condensed: () => render(true)
    })
  }

  return Object.freeze({
    prepare,
    render(document: Document | DocumentContext) {
      const message = prepare(document)
      return { standard: message.standard(), condensed: message.condensed() }
    },
    standard: Object.freeze({
      render: (document: Document | DocumentContext) =>
        prepare(document).standard()
    }),
    condensed: Object.freeze({
      render: (document: Document | DocumentContext) =>
        prepare(document).condensed()
    })
  })
}
