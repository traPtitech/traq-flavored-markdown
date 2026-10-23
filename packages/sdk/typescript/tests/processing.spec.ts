import { file } from 'bun'
import { expect, test } from 'bun:test'

import structureFixtures from '../../../../tests/fixtures/document-structure.json' with { type: 'json' }
import { createRuntime, presets } from '../../dist/index.js'
import type { ReadonlyDocument } from '../../dist/index.js'

const bytes = await file(
  new URL('../../dist/parser.wasm', import.meta.url)
).bytes()

test('fused processing returns the same AST, extraction and text as independent consumers', async () => {
  const runtime = await createRuntime(bytes)
  try {
    const origin = 'https://q.example.test'
    const source =
      '**hello**\n\n' + origin + '/files/00000000-0000-0000-0000-000000000001'
    const parser = runtime.createParser(presets.traq.v1)
    const extractor = runtime.createExtractor({ origin })
    const renderer = runtime.createPlainTextRenderer({ origin })
    const processor = runtime.createProcessor(presets.traq.v1, { origin })
    for (const inline of [false, true]) {
      const document = inline
        ? parser.parseInline(source)
        : parser.parse(source)
      const result = inline
        ? processor.processInline(source)
        : processor.process(source)
      expect(result).toEqual({
        document,
        extraction: extractor.extract(document),
        plainText: renderer.render(document)
      })
    }
    const preserved = runtime.createProcessor(presets.traq.v1, {
      whitespace: 'preserve'
    })
    expect(preserved.process('a\n\nb').plainText).toContain('\n')
    expect(processor.process('a\n\nb').plainText).toBe('a b')
    processor.dispose()
    expect(() => processor.process(source)).toThrow(/disposed/)
    expect(preserved.process(source).document.source.text).toBe(source)
  } finally {
    runtime.dispose()
  }
})

test('native Wasm operations follow the shared cross-language structure contract', async () => {
  const runtime = await createRuntime(bytes)
  try {
    const extractor = runtime.createExtractor()
    const renderer = runtime.createPlainTextRenderer()
    for (const fixture of structureFixtures) {
      const document = fixture.document as ReadonlyDocument
      for (const operation of [
        () => extractor.extract(document),
        () => renderer.render(document)
      ]) {
        if (fixture.valid) expect(operation, fixture.name).not.toThrow()
        else {
          let failure: unknown
          try {
            operation()
          } catch (error) {
            failure = error
          }
          expect(failure, fixture.name).toMatchObject({
            code: 'invalid_document'
          })
        }
      }
    }
  } finally {
    runtime.dispose()
  }
})

test('native text rendering and extraction resolve omitted options and expose typed failures', async () => {
  const runtime = await createRuntime(bytes)
  try {
    const parser = runtime.createParser(presets.traq.v1)
    const extractor = runtime.createExtractor()
    const renderer = runtime.createPlainTextRenderer()
    const document = parser.parse('**hello** world')
    expect(extractor.extract(document).messageText).toBe('**hello** world')
    expect(renderer.render(document)).toBe('hello world')
    renderer.dispose()
    try {
      renderer.render(document)
      throw new Error('Expected disposed error')
    } catch (error) {
      expect(error).toMatchObject({ code: 'disposed', operation: 'render' })
    }
    expect(extractor.extract(document).messageText).toBe(document.source.text)
  } finally {
    runtime.dispose()
  }
})

test('processing rejects malformed sibling spans without poisoning the extractor', async () => {
  const runtime = await createRuntime(bytes)
  try {
    const parser = runtime.createParser(presets.traq.v1)
    const extractor = runtime.createExtractor({ origin: '' })
    const reference = (name: string) =>
      '!' +
      JSON.stringify({
        type: 'user',
        id: '00000000-0000-0000-0000-000000000001',
        raw: '@' + name
      })
    const document = parser.parseInline(
      reference('alice') + ' ' + reference('bob')
    )
    const reordered = document.toMutable()
    reordered.children.reverse()
    const duplicated = document.toMutable()
    duplicated.children.push(...duplicated.children)
    const crossing = document.toMutable()
    const last = crossing.children.at(-1)!
    last.span.start = crossing.children[0].span.end - 1
    for (const candidate of [reordered, duplicated, crossing])
      expect(() => extractor.extract(candidate)).toThrow(/span/)
    expect(extractor.extract(document).messageText).toBe('@alice @bob')
  } finally {
    runtime.dispose()
  }
})

test('processing consumes the supplied AST and returns metadata without rendering', async () => {
  const runtime = await createRuntime(bytes)
  const parser = runtime.createParser(presets.traq.v1)
  const extractor = runtime.createExtractor({
    origin: 'https://q.example.test'
  })
  const source =
    '**!{"type":"user","id":"00000000-0000-0000-0000-000000000001","raw":"@alice"}**'
  const document = parser.parse(source)
  const original = document.toMutable()
  const output = extractor.extract(document)
  expect(Object.keys(output).sort()).toEqual([
    'attachments',
    'citations',
    'messageText',
    'referenceEmbedding',
    'references'
  ])
  expect(output.messageText).toBe('**@alice**')
  expect(output.references.mentions.length).toBe(1)
  expect(extractor.extract(document)).toEqual(output)
  expect(document.document).toEqual(original)
  // @ts-expect-error This verifies that extract rejects source text at runtime.
  expect(() => extractor.extract(source)).toThrow()
  const invalid = document.toMutable()
  invalid.children[0].span.end = source.length + 1
  expect(() => extractor.extract(invalid)).toThrow()
  expect(extractor.extract(document)).toEqual(output)
})

test('one extractor accepts ASTs from different grammar versions', async () => {
  const runtime = await createRuntime(bytes)
  const parsers = new Map(
    [presets.commonmark, presets.traq.v1].map(version => [
      version,
      runtime.createParser(version)
    ])
  )
  const extractor = runtime.createExtractor({ origin: '' })
  const source =
    '!{"type":"user","id":"00000000-0000-0000-0000-000000000001","raw":"@alice"}'
  for (const version of [
    presets.commonmark,
    presets.traq.v1,
    presets.commonmark
  ]) {
    const parser = parsers.get(version)
    if (!parser) throw new Error(`Missing parser: ${version}`)
    const output = extractor.extract(parser.parse(source))
    expect(output.references.mentions.length).toBe(
      version === 'commonmark' ? 0 : 1
    )
  }
  // @ts-expect-error Exercise the runtime boundary for an unknown JavaScript preset.
  expect(() => runtime.createParser('traq.unknown')).toThrow(
    /unknown grammar version/
  )
})

test('AST processing configuration and instances have independent lifetimes', async () => {
  const runtime = await createRuntime(bytes)
  try {
    const parser = runtime.createParser(presets.traq.v1)
    const source =
      'https://q.example.test/files/00000000-0000-0000-0000-000000000001'
    const document = parser.parse(source)
    const options = { origin: 'https://q.example.test' }
    const configured = runtime.createExtractor(options)
    options.origin = 'changed'
    const plain = runtime.createExtractor({ origin: '' })
    expect(configured.extract(document).attachments.length).toBe(1)
    expect(plain.extract(document).attachments.length).toBe(0)
    for (const options of [{ origin: 'x'.repeat(2049) }, { extra: true }]) {
      expect(() =>
        runtime.createExtractor(options as { origin: string })
      ).toThrow()
    }
    const large = parser.parse('x'.repeat(60000))
    expect(plain.extract(large).messageText).toBe(large.source.text)
    configured.dispose()
    configured.dispose()
    expect(() => configured.extract(document)).toThrow(/disposed/)
    expect(plain.extract(document).messageText).toBe(source)
    runtime.dispose()
    expect(() => plain.extract(document)).toThrow(/disposed/)
    expect(() => runtime.createExtractor({ origin: '' })).toThrow(/disposed/)
  } finally {
    runtime.dispose()
  }
})
