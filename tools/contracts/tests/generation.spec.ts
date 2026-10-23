import { expect, test } from 'bun:test'

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
  ])
    expect(go).toMatch(expected)
  expect(() =>
    goNodes([
      [key, schema],
      ['another::BadgeData', schema]
    ])
  ).toThrow(/Duplicate generated payload type/)
})
