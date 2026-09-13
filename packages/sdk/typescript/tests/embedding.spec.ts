import { file } from 'bun'
import { expect, test } from 'bun:test'

import {
  createRuntime,
  embedReferences,
  mentionsUser,
  presets
} from '../../dist/index.js'

const bytes = await file(
  new URL('../../dist/parser.wasm', import.meta.url)
).bytes()
const fixtures = JSON.parse(
  await file(
    new URL('../../tests/fixtures/embedding.json', import.meta.url)
  ).text()
)

const userId = 'dfdff0c9-5de0-46ee-9721-2525e8bb3d44'
const groupId = 'dfabf0c9-5de0-46ee-9721-2525e8bb3d45'
const identities = {
  user: {
    a: userId,
    takashi_trap: 'dfdff0c9-5de0-46ee-9721-2525e8bb3d45',
    takashi_trape: 'dfdff0c9-5de0-46ee-9721-2525e8bb3d46',
    very_long_long_long_long_lo_name: 'dfdff0c9-5de0-46ee-9721-2525e8bb3d47'
  },
  group: {
    okあok: groupId,
    takashi_trapo: 'dfabf0c9-5de0-46ee-9721-2525e8bb3d46',
    'a"b': groupId,
    'a"}': groupId
  },
  channel: { a: 'ea452867-553b-4808-a14f-a47ee0009ee6', 64: userId }
}

test('embedding and restoration use Rust AST ranges without reparsing source text', async () => {
  const runtime = await createRuntime(bytes)
  const parser = runtime.createParser(presets.traq.v1)
  const extractor = runtime.createExtractor({ origin: '' })
  const process = (source: string) => extractor.extract(parser.parse(source))
  const embed = (source: string) =>
    embedReferences(
      source,
      process(source).embedding,
      (kind: string, name: string) =>
        (identities as Record<string, Record<string, string>>)[kind]?.[name]
    )

  try {
    for (const [source, expected] of fixtures) {
      expect(embed(source)).toBe(expected)
    }

    const reference = `!${JSON.stringify({ type: 'user', raw: '@a', id: userId })}`
    const preserved = [
      '~~~\n@a\n~~~',
      '> ```\n> @a\n> ```',
      '    @a',
      '[label @a](https://example.com/@a)',
      '![alt @a](https://example.com/image.png)',
      '\\@a &#64;a \\#a',
      reference,
      `\`${reference}\``
    ]

    for (const source of preserved) {
      expect(embed(source)).toBe(source)
    }

    expect(embed('日本語😀 **@a**')).toBe(`日本語😀 **${reference}**`)

    const escaped = embed('@a"b')
    expect(process(escaped).embedding.unembeddedText).toBe('@a"b')

    const linkedReference = '[label ' + reference + '](https://example.com)'
    expect(
      process(linkedReference).embedding.unembeddedText,
      '[label @a](https://example.com)'
    ).toBe('[label @a](https://example.com)')

    for (const protectedSource of [
      '\x60\x60\x60\n' + reference + '\n\x60\x60\x60',
      '$$\n' + reference + '\n$$'
    ]) {
      expect(
        process(protectedSource).embedding.unembeddedText,
        protectedSource
      ).toBe(protectedSource)
    }

    const source = `日本語😀 ${reference} \`${reference}\` !!${reference}!!`
    const output = process(source)
    expect(
      output.embedding.unembeddedText,
      `日本語😀 @a \`${reference}\` !!@a!!`
    ).toBe(`日本語😀 @a \`${reference}\` !!@a!!`)
    expect(mentionsUser(output.references, userId, [])).toBe(true)
    expect(
      mentionsUser(process(`\`${reference}\``).references, userId, [])
    ).toBe(false)

    const groupReference =
      '!' + JSON.stringify({ type: 'group', raw: '@group', id: groupId })
    expect(
      mentionsUser(process(groupReference).references, userId, [groupId])
    ).toBe(true)
    expect(mentionsUser(process(groupReference).references, userId, [])).toBe(
      false
    )
    expect(mentionsUser(process(reference).references, groupId, [])).toBe(false)
    expect(
      mentionsUser(process('!{invalid:json}').references, userId, [groupId])
    ).toBe(false)
    expect(mentionsUser(process('').references, userId, [groupId])).toBe(false)

    expect(() =>
      embedReferences('different', process('@a').embedding, () => userId)
    ).toThrow(/does not match source/)
  } finally {
    runtime.dispose()
  }
})
