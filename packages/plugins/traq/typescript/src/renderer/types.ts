import type {
  Reference,
  StampKind
} from '@traq-flavored-markdown/traq-plugin/nodes'

export interface ResolvedReference {
  href?: string
  label?: string
  highlight?: boolean
}

export type ReferenceResolver = (
  reference: Readonly<Reference>
) => Readonly<ResolvedReference> | undefined

export interface ResolvedStamp {
  url: string
  title?: string
}

export type NamedStamp = Extract<StampKind, { type: 'normal' | 'user' }>
export type StampResolver = (
  stamp: Readonly<NamedStamp>
) => Readonly<ResolvedStamp> | undefined

/** Ports supply display data; application state and routing stay with the caller. */
export interface HtmlRendererOptions {
  resolveReference?: ReferenceResolver
  resolveStamp?: StampResolver
  validateLink?(destination: string): boolean
  validateStampImage?(destination: string): boolean
  xhtmlOut?: boolean
}
