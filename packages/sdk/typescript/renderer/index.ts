import { math } from '@traq-flavored-markdown/commonmark-plugin/generic/math'
import type { Options as GenericOptions } from '@traq-flavored-markdown/commonmark-plugin/generic/renderer'
import { plugin as generic } from '@traq-flavored-markdown/commonmark-plugin/generic/renderer'
import { createHighlightFunc } from '@traq-flavored-markdown/commonmark-plugin/highlight'
import type { Options as CommonOptions } from '@traq-flavored-markdown/commonmark-plugin/renderer'
import { plugin as common } from '@traq-flavored-markdown/commonmark-plugin/renderer'
import { PresetBuilder } from '@traq-flavored-markdown/core/renderer'
import type { Document } from '@traq-flavored-markdown/core/renderer'
import { renderer } from '@traq-flavored-markdown/core/renderer'
import type { Options as TrapOptions } from '@traq-flavored-markdown/traq-plugin/renderer'
import { plugin as trap } from '@traq-flavored-markdown/traq-plugin/renderer'

import { configureCondensed } from './condensed.js'
import { prepareMessage } from './embeddings.js'
import imageDomains from './image-domains.js'

export { embeddingFromUrl, endsWithEmbedding } from './embeddings.js'
export type { Embedding } from './embeddings.js'

export type Options = CommonOptions & GenericOptions & TrapOptions

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

function build(options: Options = {}, condensed = false) {
  const commonPlugin = common({
    breaks: true,
    highlight,
    validateImage,
    linkAttributes: {
      target: '_blank',
      rel: 'nofollow noopener noreferrer'
    },
    ...options
  })

  const genericPlugin = generic(condensed ? condensedOptions(options) : options)

  const trapPlugin = trap(options)

  if (condensed) {
    configureCondensed(commonPlugin, genericPlugin, trapPlugin, options)
  }

  return new PresetBuilder()
    .add(commonPlugin)
    .add(genericPlugin)
    .add(trapPlugin)
    .build()
}

export function html(options?: Options) {
  return build(options)
}

/** Build standard and condensed message renderers from the same options. */
export function messageRenderers({
  origin,
  ...options
}: Options & { origin: string }) {
  const embeddingOrigin = new URL(origin).origin

  function create(condensed: boolean) {
    const view = renderer(build(options, condensed))

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
