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
/**
 * A source blank line preserved for document layout.
 */
export type BlankLine = Record<string, never>
export type Embedding = {
  id: ReferenceIdentity
  label: string
  /**
   * Original JSON notation, available to renderers that display it as text.
   */
  literal: string
  type: EmbeddingKind
}
export type EmbeddingKind = 'file' | 'message'
/**
 * Lossless authored ID with its semantic identity parsed once on construction.
 * Invalid UUIDs remain accepted syntax and serialize exactly as authored.
 */
export type ReferenceIdentity = string
export type Reference = {
  id: ReferenceIdentity
  label: string
  type: ReferenceKind
}
export type ReferenceKind = 'user' | 'group' | 'channel'
export type Spoiler = Record<string, never>
export type Stamp = {
  effects: StampEffects
  kind: StampKind
  literal: string
}
export type StampAnimation =
  | 'rotate'
  | 'rotate-inv'
  | 'wiggle'
  | 'parrot'
  | 'zoom'
  | 'inversion'
  | 'turn'
  | 'turn-v'
  | 'happa'
  | 'pyon'
  | 'flashy'
  | 'pull'
  | 'atsumori'
  | 'stretch'
  | 'stretch-v'
  | 'conga'
  | 'conga-inv'
  | 'rainbow'
  | 'ascension'
  | 'shake'
  | 'party'
  | 'attract'
export type StampEffects = {
  animations: Array<StampAnimation>
  size: StampSize
}
/**
 * Syntax and display data are parsed once, before any host renders the stamp.
 */
export type StampKind =
  | {
      name: string
      type: 'normal'
    }
  | {
      name: string
      type: 'user'
    }
  | {
      rgb: number
      type: 'hex_color'
    }
  | {
      rgba: number
      type: 'hex_rgba_color'
    }
  | {
      hue: number
      lightness: number
      saturation: number
      type: 'hsl_color'
    }
export type StampSize = 'none' | 'ex-large' | 'large' | 'small'
export type NodeVariant =
  | { kind: 'traq.blank_line'; data: BlankLine }
  | { kind: 'traq.embedding'; data: Embedding }
  | { kind: 'traq.reference'; data: Reference }
  | { kind: 'traq.spoiler'; data: Spoiler }
  | { kind: 'traq.stamp'; data: Stamp }

function validateBlankLine(value: unknown): boolean {
  return ((value: unknown) => fields(value, {}, {}))(value)
}
function validateEmbedding(value: unknown): boolean {
  return ((value: unknown) =>
    fields(
      value,
      {
        id: validateReferenceIdentity,
        label: string,
        literal: string,
        type: validateEmbeddingKind
      },
      {}
    ))(value)
}
function validateEmbeddingKind(value: unknown): boolean {
  return oneOf('file', 'message')(value)
}
function validateReferenceIdentity(value: unknown): boolean {
  return string(value)
}
function validateReference(value: unknown): boolean {
  return ((value: unknown) =>
    fields(
      value,
      {
        id: validateReferenceIdentity,
        label: string,
        type: validateReferenceKind
      },
      {}
    ))(value)
}
function validateReferenceKind(value: unknown): boolean {
  return oneOf('user', 'group', 'channel')(value)
}
function validateSpoiler(value: unknown): boolean {
  return ((value: unknown) => fields(value, {}, {}))(value)
}
function validateStamp(value: unknown): boolean {
  return ((value: unknown) =>
    fields(
      value,
      {
        effects: validateStampEffects,
        kind: validateStampKind,
        literal: string
      },
      {}
    ))(value)
}
function validateStampAnimation(value: unknown): boolean {
  return oneOf(
    'rotate',
    'rotate-inv',
    'wiggle',
    'parrot',
    'zoom',
    'inversion',
    'turn',
    'turn-v',
    'happa',
    'pyon',
    'flashy',
    'pull',
    'atsumori',
    'stretch',
    'stretch-v',
    'conga',
    'conga-inv',
    'rainbow',
    'ascension',
    'shake',
    'party',
    'attract'
  )(value)
}
function validateStampEffects(value: unknown): boolean {
  return ((value: unknown) =>
    fields(
      value,
      {
        animations: (value: unknown) =>
          Array.isArray(value) &&
          value.every(validateStampAnimation) &&
          value.length <= 5,
        size: validateStampSize
      },
      {}
    ))(value)
}
function validateStampKind(value: unknown): boolean {
  return ((value: unknown) =>
    [
      (value: unknown) =>
        fields(value, { name: string, type: oneOf('normal') }, {}),
      (value: unknown) =>
        fields(value, { name: string, type: oneOf('user') }, {}),
      (value: unknown) =>
        fields(
          value,
          {
            rgb: (value: unknown) =>
              typeof value === 'number' &&
              Number.isInteger(value) &&
              value >= 0 &&
              value <= 16777215,
            type: oneOf('hex_color')
          },
          {}
        ),
      (value: unknown) =>
        fields(
          value,
          {
            rgba: (value: unknown) =>
              typeof value === 'number' &&
              Number.isInteger(value) &&
              value >= 0 &&
              value <= 4294967295,
            type: oneOf('hex_rgba_color')
          },
          {}
        ),
      (value: unknown) =>
        fields(
          value,
          {
            hue: (value: unknown) =>
              typeof value === 'number' &&
              Number.isInteger(value) &&
              value >= 0 &&
              value <= 359,
            lightness: (value: unknown) =>
              typeof value === 'number' &&
              Number.isFinite(value) &&
              value >= 0 &&
              value <= 100,
            saturation: (value: unknown) =>
              typeof value === 'number' &&
              Number.isFinite(value) &&
              value >= 0 &&
              value <= 100,
            type: oneOf('hsl_color')
          },
          {}
        )
    ].filter(check => check(value)).length === 1)(value)
}
function validateStampSize(value: unknown): boolean {
  return oneOf('none', 'ex-large', 'large', 'small')(value)
}
export const names = Object.freeze({
  BlankLine: 'traq.blank_line',
  Embedding: 'traq.embedding',
  Reference: 'traq.reference',
  Spoiler: 'traq.spoiler',
  Stamp: 'traq.stamp'
} as const)
const validators = new Map<string, (data: unknown) => boolean>([
  ['traq.blank_line', validateBlankLine],
  ['traq.embedding', validateEmbedding],
  ['traq.reference', validateReference],
  ['traq.spoiler', validateSpoiler],
  ['traq.stamp', validateStamp]
])
export const definitions = Object.freeze({
  BlankLine: defineNode<Extract<NodeVariant, { kind: typeof names.BlankLine }>>(
    names.BlankLine,
    validators.get(names.BlankLine)!,
    { role: 'block', children: { kind: 'leaf' } }
  ),
  Embedding: defineNode<Extract<NodeVariant, { kind: typeof names.Embedding }>>(
    names.Embedding,
    validators.get(names.Embedding)!,
    { role: 'inline', children: { kind: 'leaf' } }
  ),
  Reference: defineNode<Extract<NodeVariant, { kind: typeof names.Reference }>>(
    names.Reference,
    validators.get(names.Reference)!,
    { role: 'inline', children: { kind: 'leaf' } }
  ),
  Spoiler: defineNode<Extract<NodeVariant, { kind: typeof names.Spoiler }>>(
    names.Spoiler,
    validators.get(names.Spoiler)!,
    {
      role: 'inline',
      children: { kind: 'roles', roles: ['inline'], nonempty: false }
    }
  ),
  Stamp: defineNode<Extract<NodeVariant, { kind: typeof names.Stamp }>>(
    names.Stamp,
    validators.get(names.Stamp)!,
    { role: 'inline', children: { kind: 'leaf' } }
  )
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
