import { write } from 'bun'
import { expect, test } from 'bun:test'

import { withTempDirectory } from '../testing/temp-directory.ts'
import { goNodes } from './go.ts'
import { nodeFiles } from './nodes.ts'

test('Rust-exported payloads generate shared host contracts', async () => {
  await withTempDirectory('markdown-contract-', async directory => {
    await write(
      `${directory}/BadgeData.ts`,
      'export type BadgeData = { label:string; active:boolean };\n'
    )
    await write(
      `${directory}/ParseError.ts`,
      'export type ParseError = {code:"internal_error"};\n'
    )
    const schema = {
      title: 'BadgeData',
      type: 'object',
      additionalProperties: false,
      properties: { label: { type: 'string' }, active: { type: 'boolean' } },
      required: ['label', 'active']
    }
    const key = 'custom::BadgeData'
    const manifest = { nodes: { [key]: { schema, group: 'custom' } } }

    expect((await nodeFiles(manifest, directory)).get('custom.ts')).toMatch(
      /kind: "custom::BadgeData"; data: BadgeData/
    )
    const go = goNodes([[key, schema]])
    for (const expected of [
      /Label string/,
      /Active bool/,
      /case BadgeName: return &Badge\{\}/
    ])
      expect(go).toMatch(expected)
    expect(() =>
      goNodes([
        [key, schema],
        ['another::BadgeData', schema]
      ])
    ).toThrow(/Duplicate generated payload type/)
  })
})
