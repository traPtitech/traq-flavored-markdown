import { plugin as common } from '@traq-flavored-markdown/commonmark-plugin/renderer'
import type { DocumentContext } from '@traq-flavored-markdown/core'
import { PresetBuilder } from '@traq-flavored-markdown/core/renderer'
import type { ReadonlyDocument } from '@traq-flavored-markdown/core/renderer'
import { createRenderer } from '@traq-flavored-markdown/core/renderer'
import { plugin as extensions } from '@traq-flavored-markdown/extensions-plugin/renderer'
import { plugin as trap } from '@traq-flavored-markdown/traq-plugin/renderer'

import { analyzeMessage, messageContext } from '../traq/messages/analysis.js'
import { normalizeTraqOrigin } from '../traq/messages/cards.js'
import { resolveOptions } from '../traq/profile/options.js'
import type {
  HtmlRendererOptions,
  ResolvedOptions
} from '../traq/profile/options.js'
import { configureCondensed } from '../traq/views/condensed.js'
import { messageRenderPlan } from '../traq/views/plan.js'
import { configureSpacing } from '../traq/views/spacing.js'

export { analyzeMessage, endsWithResourceCard } from '../traq/messages/analysis.js'
export type { MessageAnalysis, MessageLink } from '../traq/messages/analysis.js'
export { resourceCardFromUrl } from '../traq/messages/cards.js'
export type { ResourceCard } from '../traq/messages/cards.js'
export type {
  HtmlPlugins,
  HtmlRendererOptions
} from '../traq/profile/options.js'

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
export function createHtmlPreset(options?: HtmlRendererOptions) {
  return buildPreset(resolveOptions(options))
}

/** Create a renderer with the standard HTML handlers. */
export function createHtmlRenderer(options?: HtmlRendererOptions) {
  const resolved = resolveOptions(options)
  return createRenderer(buildPreset(resolved), { schema: resolved.schema })
}

/** Build standard and condensed message renderers from the same options. */
export function messageRenderers({
  origin,
  ...options
}: HtmlRendererOptions & { origin: string }) {
  const parsedOrigin = new URL(origin)
  if (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:')
    throw new TypeError('Expected an HTTP(S) origin')
  const cardOrigin = normalizeTraqOrigin(origin)
  const resolvedOptions = resolveOptions(options)

  const standardView = createRenderer(buildPreset(resolvedOptions), {
    schema: resolvedOptions.schema
  })
  const condensedView = createRenderer(buildPreset(resolvedOptions, true), {
    schema: resolvedOptions.schema
  })

  function prepare(document: ReadonlyDocument | DocumentContext) {
    const standard = standardView.createSession(document)
    const context = messageContext(standard.context)
    const condensed = condensedView.createSession(context)
    const analysis = analyzeMessage(
      context,
      cardOrigin,
      resolvedOptions.validateLink
    )
    const plan = messageRenderPlan(analysis, resolvedOptions.labels)
    const render = (compact: boolean) => ({
      rawText: context.source.text,
      html: (compact ? condensed : standard).render({
        roots: plan.roots,
        omittedNodes: plan.omittedNodes,
        childText: compact ? plan.childText : undefined,
        rootSeparator: compact ? ' ' : ''
      }),
      cards: analysis.cards.map(card => ({ ...card }))
    })
    return Object.freeze({
      context,
      analysis,
      standard: () => render(false),
      condensed: () => render(true)
    })
  }

  return Object.freeze({
    prepare,
    render(document: ReadonlyDocument | DocumentContext) {
      const message = prepare(document)
      return { standard: message.standard(), condensed: message.condensed() }
    },
    standard: Object.freeze({
      render: (document: ReadonlyDocument | DocumentContext) =>
        prepare(document).standard()
    }),
    condensed: Object.freeze({
      render: (document: ReadonlyDocument | DocumentContext) =>
        prepare(document).condensed()
    })
  })
}
