import { expect, test } from 'bun:test'

import {
  arrayLimits,
  contractValues
} from '../../../packages/plugins/traq/typescript/src/generated/nodes.js'
import { goNodes } from '../emitters/go.ts'
import { nodeFiles } from '../emitters/nodes.ts'

test('Rust-exported schemas generate shared host contracts', () => {
  const schema = {
    title: 'BadgeData',
    type: 'object',
    additionalProperties: false,
    properties: { label: { type: 'string' }, active: { type: 'boolean' } },
    required: ['label', 'active']
  }

  const key = 'custom::BadgeData'
  const manifest = { nodes: { [key]: { schema, group: 'custom' } } }

  expect(nodeFiles(manifest).get('custom.ts')).toMatch(
    /kind: "custom::BadgeData"; data: BadgeData/
  )

  expect(nodeFiles(manifest).get('custom.ts')).toContain(
    'export type BadgeData ='
  )

  const go = goNodes([[key, schema]])

  for (const expected of [
    /Label string/,
    /Active bool/,
    /case BadgeDataName: return &BadgeData\{\}/
  ]) {
    expect(go).toMatch(expected)
  }

  expect(() =>
    goNodes([
      [key, schema],
      ['another::BadgeData', schema]
    ])
  ).toThrow('Conflicting Go identifier BadgeDataName')
})

test('enum values and collection limits are generated from contracts for host editors', () => {
  const generated = nodeFiles({
    nodes: {
      'custom::Effects': {
        group: 'custom',
        schema: {
          title: 'Effects',
          type: 'object',
          additionalProperties: false,
          properties: {
            animations: {
              type: 'array',
              minItems: 1,
              maxItems: 3,
              items: { $ref: '#/$defs/Animation' }
            }
          },
          required: ['animations'],
          $defs: { Animation: { type: 'string', enum: ['first', 'second'] } }
        }
      }
    }
  }).get('custom.ts')!

  expect(generated).toContain(
    '"Animation": Object.freeze(["first", "second"] as const)'
  )

  expect(generated).toContain(
    '"animations": Object.freeze({"minItems":1,"maxItems":3})'
  )

  expect(contractValues.StampAnimation).toContain('rotate')

  expect(contractValues.StampSize).toEqual([
    'none',
    'ex-large',
    'large',
    'small'
  ])

  expect(arrayLimits.StampEffects.animations).toEqual({ maxItems: 5 })
  expect(Object.isFrozen(contractValues.StampAnimation)).toBe(true)
  expect(Object.isFrozen(arrayLimits.StampEffects.animations)).toBe(true)
})
