import { math } from '@traq-flavored-markdown/commonmark-plugin/generic/math'
import type { Options as GenericOptions } from '@traq-flavored-markdown/commonmark-plugin/generic/renderer'
import { plugin as generic } from '@traq-flavored-markdown/commonmark-plugin/generic/renderer'
import { createHighlightFunc } from '@traq-flavored-markdown/commonmark-plugin/highlight'
import { validateLink as defaultLinkPolicy } from '@traq-flavored-markdown/commonmark-plugin/policy'
import type { Options as CommonOptions } from '@traq-flavored-markdown/commonmark-plugin/renderer'
import { plugin as common } from '@traq-flavored-markdown/commonmark-plugin/renderer'
import { PresetBuilder } from '@traq-flavored-markdown/core/renderer'
import type { Document, Plugin } from '@traq-flavored-markdown/core/renderer'
import { renderer } from '@traq-flavored-markdown/core/renderer'
import type { Options as TrapOptions } from '@traq-flavored-markdown/traq-plugin/renderer'
import { plugin as trap } from '@traq-flavored-markdown/traq-plugin/renderer'

import { configureCondensed } from './condensed.js'
import { prepareMessage } from './embeddings.js'
import imageDomains from './image-domains.js'
import { normalizeTraqOrigin } from './links.js'

export { endsWithEmbedding } from './embeddings.js'
export { embeddingFromUrl } from './links.js'
export type { Embedding } from './links.js'

export interface HtmlPlugins {
  common: Plugin
  generic: Plugin
  traq: Plugin
}

export type Options = CommonOptions &
  GenericOptions &
  TrapOptions & {
    /** Additional handlers for nodes outside the built-in plugins. */
    plugins?: readonly Plugin[]
    /** Customize built-in handlers before the preset captures them. */
    configurePlugins?: (plugins: HtmlPlugins) => void
  }

const highlight = createHighlightFunc('traq-code traq-lang')

const validateImage = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && imageDomains.includes(url.hostname)
  } catch {
    return false
  }
}

function condensedOptions(options: Options) {
  const customMath = options.math

  return {
    ...options,
    math: customMath
      ? (tex: string) => customMath(tex, false)
      : (tex: string) =>
          math(tex, false, {
            maxSize: 1,
            macros: {
              '\\Huge': '',
              '\\huge': '',
              '\\LARGE': '',
              '\\Large': '',
              '\\large': ''
            }
          })
  }
}

function buildPreset(
  { plugins = [], configurePlugins, ...options }: Options = {},
  condensed = false
) {
  const validateLink = options.validateLink ?? defaultLinkPolicy
  const commonPlugin = common({
    breaks: true,
    rawHtml: 'escape',
    xhtmlOut: false,
    highlight,
    validateLink,
    validateImage,
    linkAttributes: {
      target: '_blank',
      rel: 'nofollow noopener noreferrer'
    },
    ...options
  })

  const genericPlugin = generic(condensed ? condensedOptions(options) : options)

  const trapPlugin = trap({ ...options, validateLink })

  if (condensed) {
    configureCondensed(commonPlugin, genericPlugin, trapPlugin, options)
  }

  configurePlugins?.({
    common: commonPlugin,
    generic: genericPlugin,
    traq: trapPlugin
  })

  const builder = new PresetBuilder()
    .add(commonPlugin)
    .add(genericPlugin)
    .add(trapPlugin)
  for (const plugin of plugins) builder.add(plugin)
  return builder.build()
}

/** Compose the standard HTML handlers with optional third-party plugins. */
export function htmlPreset(options?: Options) {
  return buildPreset(options)
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
  const embeddingOrigin = normalizeTraqOrigin(origin)

  function create(condensed: boolean) {
    const view = renderer(buildPreset(options, condensed))

    return Object.freeze({
      render(document: Document) {
        const prepared = prepareMessage(document, embeddingOrigin, condensed)
        const renderedText = condensed
          ? prepared.document.children
              .map(node =>
                view.render({
                  ...prepared.document,
                  children: [node]
                })
              )
              .join(' ')
          : view.render(prepared.document)

        return {
          rawText: document.source,
          renderedText,
          embeddings: prepared.embeddings
        }
      }
    })
  }

  return Object.freeze({
    standard: create(false),
    condensed: create(true)
  })
}
