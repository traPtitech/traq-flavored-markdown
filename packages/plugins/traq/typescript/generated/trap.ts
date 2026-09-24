// Generated from Rust node payload types. Do not edit.
import {
  boolean,
  fields,
  nullable,
  oneOf,
  string
} from '@traq-flavored-markdown/core/validation'

// Generated from Rust contracts. Do not edit.
export type BlankLineData = Record<string, never>
export type EmbeddingData = {
  id: string
  label: string
  /**
   * Original JSON notation, available to renderers that display it as text.
   */
  literal: string
  type: EmbeddingKind
}
export type EmbeddingKind = 'file' | 'message'
export type ReferenceData = {
  id: string
  label: string
  type: ReferenceKind
}
export type ReferenceKind = 'user' | 'group' | 'channel'
export type SpoilerData = Record<string, never>
export type StampData = {
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
      name: string
      rgb: number
      type: 'hex_color'
    }
  | {
      hue: string
      lightness: string
      name: string
      saturation: string
      type: 'hsl_color'
    }
export type StampSize = 'none' | 'ex-large' | 'large' | 'small'
export type NodeKind =
  | { kind: 'traq.blank_line'; data: BlankLineData }
  | { kind: 'traq.embedding'; data: EmbeddingData }
  | { kind: 'traq.reference'; data: ReferenceData }
  | { kind: 'traq.spoiler'; data: SpoilerData }
  | { kind: 'traq.stamp'; data: StampData }

export const names = Object.freeze({
  BlankLine: 'traq.blank_line',
  Embedding: 'traq.embedding',
  Reference: 'traq.reference',
  Spoiler: 'traq.spoiler',
  Stamp: 'traq.stamp'
} as const)
const validators = new Map<string, (data: unknown) => boolean>([
  ['traq.blank_line', (value: unknown) => fields(value, {}, {})],
  [
    'traq.embedding',
    (value: unknown) =>
      fields(
        value,
        {
          id: string,
          label: string,
          literal: string,
          type: oneOf('file', 'message')
        },
        {}
      )
  ],
  [
    'traq.reference',
    (value: unknown) =>
      fields(
        value,
        { id: string, label: string, type: oneOf('user', 'group', 'channel') },
        {}
      )
  ],
  ['traq.spoiler', (value: unknown) => fields(value, {}, {})],
  [
    'traq.stamp',
    (value: unknown) =>
      fields(
        value,
        {
          effects: (value: unknown) =>
            fields(
              value,
              {
                animations: (value: unknown) =>
                  Array.isArray(value) &&
                  value.every(
                    oneOf(
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
                    )
                  ),
                size: oneOf('none', 'ex-large', 'large', 'small')
              },
              {}
            ),
          kind: (value: unknown) =>
            [
              (value: unknown) =>
                fields(value, { name: string, type: oneOf('normal') }, {}),
              (value: unknown) =>
                fields(value, { name: string, type: oneOf('user') }, {}),
              (value: unknown) =>
                fields(
                  value,
                  {
                    name: string,
                    rgb: (value: unknown) =>
                      typeof value === 'number' &&
                      Number.isInteger(value) &&
                      value >= 0 &&
                      value <= 4294967295,
                    type: oneOf('hex_color')
                  },
                  {}
                ),
              (value: unknown) =>
                fields(
                  value,
                  {
                    hue: string,
                    lightness: string,
                    name: string,
                    saturation: string,
                    type: oneOf('hsl_color')
                  },
                  {}
                )
            ].filter(check => check(value)).length === 1,
          literal: string
        },
        {}
      )
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
