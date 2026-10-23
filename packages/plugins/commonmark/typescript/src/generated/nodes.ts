// Generated from Rust node payload types. Do not edit.
import {
  type DeepReadonly,
  DocumentSchema,
  defineNode
} from '@traq-flavored-markdown/core'
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
  /**
   * Decoded CommonMark info string. Authored notation remains in the source span.
   */
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
  labelSource: string
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
  kind: ListKind
  tight: boolean
}
export type BulletMarker = '-' | '+' | '*'
export type ListKind =
  | {
      delimiter: OrderedDelimiter
      start: number
      type: 'ordered'
    }
  | {
      marker: BulletMarker
      type: 'bullet'
    }
export type OrderedDelimiter = 'period' | 'parenthesis'
export type ListItem = Record<string, never>
export type Paragraph = Record<string, never>
export type Softbreak = Record<string, never>
export type Strong = Record<string, never>
export type Text = {
  value: string
}
export type ThematicBreak = {
  marker: string
}
export type NodeVariant =
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

function validateBlockquote(value: unknown): boolean {
  return ((value: unknown) => fields(value, {}, {}))(value)
}
function validateCodeBlock(value: unknown): boolean {
  return ((value: unknown) =>
    fields(value, { fenced: boolean, info: string, literal: string }, {}))(
    value
  )
}
function validateEmphasis(value: unknown): boolean {
  return ((value: unknown) => fields(value, {}, {}))(value)
}
function validateHardbreak(value: unknown): boolean {
  return ((value: unknown) => fields(value, {}, {}))(value)
}
function validateHeading(value: unknown): boolean {
  return ((value: unknown) =>
    fields(
      value,
      {
        level: (value: unknown) =>
          typeof value === 'number' &&
          Number.isInteger(value) &&
          value >= 1 &&
          value <= 6
      },
      {}
    ))(value)
}
function validateHtmlBlock(value: unknown): boolean {
  return ((value: unknown) => fields(value, { literal: string }, {}))(value)
}
function validateHtmlInline(value: unknown): boolean {
  return ((value: unknown) => fields(value, { literal: string }, {}))(value)
}
function validateImage(value: unknown): boolean {
  return ((value: unknown) =>
    fields(
      value,
      { destination: string, labelSource: string, title: nullable(string) },
      {}
    ))(value)
}
function validateInlineCode(value: unknown): boolean {
  return ((value: unknown) => fields(value, { literal: string }, {}))(value)
}
function validateLink(value: unknown): boolean {
  return ((value: unknown) =>
    fields(
      value,
      { destination: string, form: validateLinkForm, title: nullable(string) },
      {}
    ))(value)
}
function validateLinkForm(value: unknown): boolean {
  return oneOf('explicit', 'autolink', 'linkify')(value)
}
function validateList(value: unknown): boolean {
  return ((value: unknown) =>
    fields(value, { kind: validateListKind, tight: boolean }, {}))(value)
}
function validateBulletMarker(value: unknown): boolean {
  return oneOf('-', '+', '*')(value)
}
function validateListKind(value: unknown): boolean {
  return ((value: unknown) =>
    [
      (value: unknown) =>
        fields(
          value,
          {
            delimiter: validateOrderedDelimiter,
            start: (value: unknown) =>
              typeof value === 'number' &&
              Number.isInteger(value) &&
              value >= 0 &&
              value <= 999999999,
            type: oneOf('ordered')
          },
          {}
        ),
      (value: unknown) =>
        fields(
          value,
          { marker: validateBulletMarker, type: oneOf('bullet') },
          {}
        )
    ].filter(check => check(value)).length === 1)(value)
}
function validateOrderedDelimiter(value: unknown): boolean {
  return oneOf('period', 'parenthesis')(value)
}
function validateListItem(value: unknown): boolean {
  return ((value: unknown) => fields(value, {}, {}))(value)
}
function validateParagraph(value: unknown): boolean {
  return ((value: unknown) => fields(value, {}, {}))(value)
}
function validateSoftbreak(value: unknown): boolean {
  return ((value: unknown) => fields(value, {}, {}))(value)
}
function validateStrong(value: unknown): boolean {
  return ((value: unknown) => fields(value, {}, {}))(value)
}
function validateText(value: unknown): boolean {
  return ((value: unknown) => fields(value, { value: string }, {}))(value)
}
function validateThematicBreak(value: unknown): boolean {
  return ((value: unknown) => fields(value, { marker: string }, {}))(value)
}
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
  ['commonmark.blockquote', validateBlockquote],
  ['commonmark.code_block', validateCodeBlock],
  ['commonmark.emphasis', validateEmphasis],
  ['commonmark.hardbreak', validateHardbreak],
  ['commonmark.heading', validateHeading],
  ['commonmark.html_block', validateHtmlBlock],
  ['commonmark.html_inline', validateHtmlInline],
  ['commonmark.image', validateImage],
  ['commonmark.inline_code', validateInlineCode],
  ['commonmark.link', validateLink],
  ['commonmark.list', validateList],
  ['commonmark.list_item', validateListItem],
  ['commonmark.paragraph', validateParagraph],
  ['commonmark.softbreak', validateSoftbreak],
  ['commonmark.strong', validateStrong],
  ['commonmark.text', validateText],
  ['commonmark.thematic_break', validateThematicBreak]
])
export const definitions = Object.freeze({
  Blockquote: defineNode<
    Extract<NodeVariant, { kind: typeof names.Blockquote }>
  >(names.Blockquote, validators.get(names.Blockquote)!, {
    role: 'block',
    children: { kind: 'roles', roles: ['block'], nonempty: false }
  }),
  CodeBlock: defineNode<Extract<NodeVariant, { kind: typeof names.CodeBlock }>>(
    names.CodeBlock,
    validators.get(names.CodeBlock)!,
    { role: 'block', children: { kind: 'leaf' } }
  ),
  Emphasis: defineNode<Extract<NodeVariant, { kind: typeof names.Emphasis }>>(
    names.Emphasis,
    validators.get(names.Emphasis)!,
    {
      role: 'inline',
      children: { kind: 'roles', roles: ['inline'], nonempty: false }
    }
  ),
  Hardbreak: defineNode<Extract<NodeVariant, { kind: typeof names.Hardbreak }>>(
    names.Hardbreak,
    validators.get(names.Hardbreak)!,
    { role: 'inline', children: { kind: 'leaf' } }
  ),
  Heading: defineNode<Extract<NodeVariant, { kind: typeof names.Heading }>>(
    names.Heading,
    validators.get(names.Heading)!,
    {
      role: 'block',
      children: { kind: 'roles', roles: ['inline'], nonempty: false }
    }
  ),
  HtmlBlock: defineNode<Extract<NodeVariant, { kind: typeof names.HtmlBlock }>>(
    names.HtmlBlock,
    validators.get(names.HtmlBlock)!,
    { role: 'block', children: { kind: 'leaf' } }
  ),
  HtmlInline: defineNode<
    Extract<NodeVariant, { kind: typeof names.HtmlInline }>
  >(names.HtmlInline, validators.get(names.HtmlInline)!, {
    role: 'inline',
    children: { kind: 'leaf' }
  }),
  Image: defineNode<Extract<NodeVariant, { kind: typeof names.Image }>>(
    names.Image,
    validators.get(names.Image)!,
    {
      role: 'inline',
      children: { kind: 'roles', roles: ['inline'], nonempty: false }
    }
  ),
  InlineCode: defineNode<
    Extract<NodeVariant, { kind: typeof names.InlineCode }>
  >(names.InlineCode, validators.get(names.InlineCode)!, {
    role: 'inline',
    children: { kind: 'leaf' }
  }),
  Link: defineNode<Extract<NodeVariant, { kind: typeof names.Link }>>(
    names.Link,
    validators.get(names.Link)!,
    {
      role: 'inline',
      children: { kind: 'roles', roles: ['inline'], nonempty: false }
    }
  ),
  List: defineNode<Extract<NodeVariant, { kind: typeof names.List }>>(
    names.List,
    validators.get(names.List)!,
    {
      role: 'block',
      children: {
        kind: 'types',
        types: ['commonmark.list_item'],
        nonempty: true
      }
    }
  ),
  ListItem: defineNode<Extract<NodeVariant, { kind: typeof names.ListItem }>>(
    names.ListItem,
    validators.get(names.ListItem)!,
    {
      role: 'structural',
      children: { kind: 'roles', roles: ['block'], nonempty: false }
    }
  ),
  Paragraph: defineNode<Extract<NodeVariant, { kind: typeof names.Paragraph }>>(
    names.Paragraph,
    validators.get(names.Paragraph)!,
    {
      role: 'block',
      children: { kind: 'roles', roles: ['inline'], nonempty: false }
    }
  ),
  Softbreak: defineNode<Extract<NodeVariant, { kind: typeof names.Softbreak }>>(
    names.Softbreak,
    validators.get(names.Softbreak)!,
    { role: 'inline', children: { kind: 'leaf' } }
  ),
  Strong: defineNode<Extract<NodeVariant, { kind: typeof names.Strong }>>(
    names.Strong,
    validators.get(names.Strong)!,
    {
      role: 'inline',
      children: { kind: 'roles', roles: ['inline'], nonempty: false }
    }
  ),
  Text: defineNode<Extract<NodeVariant, { kind: typeof names.Text }>>(
    names.Text,
    validators.get(names.Text)!,
    { role: 'inline', children: { kind: 'leaf' } }
  ),
  ThematicBreak: defineNode<
    Extract<NodeVariant, { kind: typeof names.ThematicBreak }>
  >(names.ThematicBreak, validators.get(names.ThematicBreak)!, {
    role: 'block',
    children: { kind: 'leaf' }
  })
})
export const schema = new DocumentSchema<NodeVariant>(
  Object.values(definitions)
)
// Check this payload only; children can still contain unknown nodes.
export function isKnownNode<T extends { kind: string; data: unknown }>(
  node: T
): node is T & DeepReadonly<NodeVariant> {
  return schema.isKnownNode(node)
}
