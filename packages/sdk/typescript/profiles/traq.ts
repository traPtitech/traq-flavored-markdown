import { createHighlighter } from '@traq-flavored-markdown/commonmark-plugin/highlight'
import {
  validateLink as defaultLinkPolicy,
  validateImage as defaultStampPolicy
} from '@traq-flavored-markdown/commonmark-plugin/policy'
import type { HighlightResult } from '@traq-flavored-markdown/commonmark-plugin/renderer'
import type { RenderPlugin } from '@traq-flavored-markdown/core/renderer'
import { math } from '@traq-flavored-markdown/extensions-plugin/math'
import { names } from '@traq-flavored-markdown/traq-plugin/nodes'
import type {
  ReferenceResolver,
  StampResolver
} from '@traq-flavored-markdown/traq-plugin/renderer'

import imageDomains from './image-domains.js'

export interface HtmlPlugins {
  common: RenderPlugin
  extensions: RenderPlugin
  traq: RenderPlugin
}

export interface Options {
  links?: {
    validate?(destination: string): boolean
    attributes?: Readonly<Record<string, string>>
  }
  images?: { validate?(destination: string): boolean }
  code?: {
    highlight?(code: string, language: string): HighlightResult | undefined
  }
  math?: { render?(tex: string, displayMode: boolean): string }
  references?: { resolve?: ReferenceResolver }
  stamps?: {
    resolve?: StampResolver
    validateUrl?(destination: string): boolean
  }
  presentation?: {
    breaks?: boolean
    rawHtml?: 'passthrough' | 'escape'
    xhtmlOut?: boolean
  }
  /** Additional handlers for nodes outside the built-in plugins. */
  plugins?: readonly RenderPlugin[]
  /** Return customized built-in handlers for the preset. */
  configurePlugins?: (plugins: HtmlPlugins) => HtmlPlugins
}

const highlight = createHighlighter({ preClass: 'traq-code traq-lang' })

function validateImage(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && imageDomains.includes(url.hostname)
  } catch {
    return false
  }
}

/** Resolve display policy once; explicit undefined has the same meaning as omission. */
export function resolveOptions(options: Options = {}) {
  const customMath = options.math?.render
  return {
    plugins: options.plugins ?? [],
    configurePlugins: options.configurePlugins,
    breaks: options.presentation?.breaks ?? true,
    rawHtml: options.presentation?.rawHtml ?? 'escape',
    xhtmlOut: options.presentation?.xhtmlOut ?? false,
    highlight: options.code?.highlight ?? highlight,
    validateLink: options.links?.validate ?? defaultLinkPolicy,
    validateImage: options.images?.validate ?? validateImage,
    validateStampImage: options.stamps?.validateUrl ?? defaultStampPolicy,
    resolveReference: options.references?.resolve,
    resolveStamp: options.stamps?.resolve,
    linkAttributes: options.links?.attributes ?? {
      target: '_blank',
      rel: 'nofollow noopener noreferrer'
    },
    isBlockSpacing: (node: { kind: string }) => node.kind === names.BlankLine,
    math: customMath ?? math,
    condensedMath: customMath
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

export type ResolvedOptions = ReturnType<typeof resolveOptions>
