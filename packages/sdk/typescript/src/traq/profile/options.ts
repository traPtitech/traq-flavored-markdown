import type { HighlightResult } from '@traq-flavored-markdown/commonmark-plugin/renderer'
import type { DocumentSchema } from '@traq-flavored-markdown/core'
import {
  validateLink as defaultLinkPolicy,
  validateImage as defaultStampPolicy
} from '@traq-flavored-markdown/core/html'
import type { RenderPlugin } from '@traq-flavored-markdown/core/renderer'
import { names } from '@traq-flavored-markdown/traq-plugin/nodes'
import type {
  ReferenceResolver,
  StampResolver
} from '@traq-flavored-markdown/traq-plugin/renderer'

import { schema } from '../../generated/nodes.js'
import { resourceLabels } from '../messages/labels.js'
import imageDomains from './image-domains.js'

export interface HtmlPlugins {
  common: RenderPlugin
  extensions: RenderPlugin
  traq: RenderPlugin
}

export interface HtmlRendererOptions {
  /** Application node contracts, independent of HTML handlers. */
  schema?: DocumentSchema
  labels?: Partial<{ file: string; message: string }>

  links?: {
    validate?(destination: string): boolean
    attributes?: Readonly<Record<string, string>>
  }
  images?: {
    validate?(destination: string): boolean
    domains?: readonly string[]
  }
  code?: {
    highlight?(code: string, language: string): HighlightResult | undefined
  }
  math?: {
    render?(tex: string, displayMode: boolean): string
    renderCondensed?(tex: string): string
  }
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

function validateImage(value: string, domains: ReadonlySet<string>) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && domains.has(url.hostname)
  } catch {
    return false
  }
}

/** Resolve display policy once; explicit undefined has the same meaning as omission. */
export function resolveOptions(options: HtmlRendererOptions = {}) {
  const customMath = options.math?.render
  const domains = new Set(options.images?.domains ?? imageDomains)
  return {
    schema: options.schema ?? schema.withUnknownNodes(),
    labels: {
      file: options.labels?.file ?? resourceLabels.file,
      message: options.labels?.message ?? resourceLabels.message
    },
    plugins: options.plugins ?? [],
    configurePlugins: options.configurePlugins,
    breaks: options.presentation?.breaks ?? true,
    rawHtml: options.presentation?.rawHtml ?? 'escape',
    xhtmlOut: options.presentation?.xhtmlOut ?? false,
    highlight: options.code?.highlight,
    validateLink: options.links?.validate ?? defaultLinkPolicy,
    validateImage:
      options.images?.validate ??
      ((value: string) => validateImage(value, domains)),
    validateStampImage: options.stamps?.validateUrl ?? defaultStampPolicy,
    resolveReference: options.references?.resolve,
    resolveStamp: options.stamps?.resolve,
    linkAttributes: options.links?.attributes ?? {
      target: '_blank',
      rel: 'nofollow noopener noreferrer'
    },
    isBlockSpacing: (node: { kind: string }) => node.kind === names.BlankLine,
    math: customMath,
    condensedMath:
      options.math?.renderCondensed ??
      (customMath ? (tex: string) => customMath(tex, false) : undefined)
  }
}

export type ResolvedOptions = ReturnType<typeof resolveOptions>
