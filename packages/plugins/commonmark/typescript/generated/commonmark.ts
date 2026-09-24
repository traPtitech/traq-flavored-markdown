// Generated from Rust node payload types. Do not edit.
import {
  boolean,
  fields,
  nullable,
  oneOf,
  string
} from '@traq-flavored-markdown/core/validation'

// Generated from Rust contracts. Do not edit.
export type Blockquote = Record<string, never>
export type CodeBlock = {
  fenced: boolean
  info: string
  literal: string
}
export type Emphasis = Record<string, never>
export type Hardbreak = Record<string, never>
export type Heading = {
  level: number
}
export type HtmlBlock = {
  literal: string
}
export type HtmlInline = {
  literal: string
}
export type Image = {
  destination: string
  label_source: string
  title: string | null
}
export type InlineCode = {
  literal: string
}
export type Link = {
  destination: string
  form: LinkForm
  title: string | null
}
export type LinkForm = 'explicit' | 'autolink' | 'linkify'
export type List = {
  ordered: boolean
  start: number
  tight: boolean
}
export type ListItem = {
  marker: string
}
export type Paragraph = Record<string, never>
export type Softbreak = Record<string, never>
export type Strong = Record<string, never>
export type Text = {
  value: string
}
export type ThematicBreak = {
  marker: string
}
export type NodeKind =
  | { kind: 'commonmark.blockquote'; data: Blockquote }
  | { kind: 'commonmark.code_block'; data: CodeBlock }
  | { kind: 'commonmark.emphasis'; data: Emphasis }
  | { kind: 'commonmark.hardbreak'; data: Hardbreak }
  | { kind: 'commonmark.heading'; data: Heading }
  | { kind: 'commonmark.html_block'; data: HtmlBlock }
  | { kind: 'commonmark.html_inline'; data: HtmlInline }
  | { kind: 'commonmark.image'; data: Image }
  | { kind: 'commonmark.inline_code'; data: InlineCode }
  | { kind: 'commonmark.link'; data: Link }
  | { kind: 'commonmark.list'; data: List }
  | { kind: 'commonmark.list_item'; data: ListItem }
  | { kind: 'commonmark.paragraph'; data: Paragraph }
  | { kind: 'commonmark.softbreak'; data: Softbreak }
  | { kind: 'commonmark.strong'; data: Strong }
  | { kind: 'commonmark.text'; data: Text }
  | { kind: 'commonmark.thematic_break'; data: ThematicBreak }

export const names = Object.freeze({
  Blockquote: 'commonmark.blockquote',
  CodeBlock: 'commonmark.code_block',
  Emphasis: 'commonmark.emphasis',
  Hardbreak: 'commonmark.hardbreak',
  Heading: 'commonmark.heading',
  HtmlBlock: 'commonmark.html_block',
  HtmlInline: 'commonmark.html_inline',
  Image: 'commonmark.image',
  InlineCode: 'commonmark.inline_code',
  Link: 'commonmark.link',
  List: 'commonmark.list',
  ListItem: 'commonmark.list_item',
  Paragraph: 'commonmark.paragraph',
  Softbreak: 'commonmark.softbreak',
  Strong: 'commonmark.strong',
  Text: 'commonmark.text',
  ThematicBreak: 'commonmark.thematic_break'
} as const)
const validators = new Map<string, (data: unknown) => boolean>([
  ['commonmark.blockquote', (value: unknown) => fields(value, {}, {})],
  [
    'commonmark.code_block',
    (value: unknown) =>
      fields(value, { fenced: boolean, info: string, literal: string }, {})
  ],
  ['commonmark.emphasis', (value: unknown) => fields(value, {}, {})],
  ['commonmark.hardbreak', (value: unknown) => fields(value, {}, {})],
  [
    'commonmark.heading',
    (value: unknown) =>
      fields(
        value,
        {
          level: (value: unknown) =>
            typeof value === 'number' &&
            Number.isInteger(value) &&
            value >= 0 &&
            value <= 255
        },
        {}
      )
  ],
  [
    'commonmark.html_block',
    (value: unknown) => fields(value, { literal: string }, {})
  ],
  [
    'commonmark.html_inline',
    (value: unknown) => fields(value, { literal: string }, {})
  ],
  [
    'commonmark.image',
    (value: unknown) =>
      fields(
        value,
        { destination: string, label_source: string, title: nullable(string) },
        {}
      )
  ],
  [
    'commonmark.inline_code',
    (value: unknown) => fields(value, { literal: string }, {})
  ],
  [
    'commonmark.link',
    (value: unknown) =>
      fields(
        value,
        {
          destination: string,
          form: oneOf('explicit', 'autolink', 'linkify'),
          title: nullable(string)
        },
        {}
      )
  ],
  [
    'commonmark.list',
    (value: unknown) =>
      fields(
        value,
        {
          ordered: boolean,
          start: (value: unknown) =>
            typeof value === 'number' &&
            Number.isInteger(value) &&
            value >= 0 &&
            value <= 4294967295,
          tight: boolean
        },
        {}
      )
  ],
  [
    'commonmark.list_item',
    (value: unknown) => fields(value, { marker: string }, {})
  ],
  ['commonmark.paragraph', (value: unknown) => fields(value, {}, {})],
  ['commonmark.softbreak', (value: unknown) => fields(value, {}, {})],
  ['commonmark.strong', (value: unknown) => fields(value, {}, {})],
  ['commonmark.text', (value: unknown) => fields(value, { value: string }, {})],
  [
    'commonmark.thematic_break',
    (value: unknown) => fields(value, { marker: string }, {})
  ]
])
export const nodes: ReadonlyMap<string, (data: unknown) => boolean> = new Map(
  validators
)
// Check this payload only; children can still contain unknown nodes.
export function isKnownNode<T extends { kind: string; data: unknown }>(
  node: T
): node is T & NodeKind {
  return validators.get(node.kind)?.(node.data) ?? false
}
