import { file } from 'bun'
import { expect, test } from 'bun:test'

import { buildId } from '../../dist/generated/artifact.js'
import { names } from '../../dist/generated/nodes.js'
import { createRuntime, isKnownNode, presets } from '../../dist/index.js'

const bytes = await file(
  new URL('../../dist/parser.wasm', import.meta.url)
).bytes()
const captureError = (run: () => unknown) => {
  try {
    run()
  } catch (error) {
    return error
  }
}

test('failed requests do not poison later calls; resources remain bounded', async () => {
  const runtime = await createRuntime(bytes)
  const core = runtime.createParser(presets.traq.v1)
  for (const [source, code] of [
    ['\ud800', 'invalid_utf8'],
    ['x'.repeat(65537), 'resource_limit']
  ]) {
    const error = captureError(() => core.parse(source))
    if (code === 'invalid_utf8') expect(error).toBeInstanceOf(TypeError)
    else
      expect(error).toMatchObject({
        cause: { code: 'resource_limit', resource: 'input_bytes' }
      })
  }
  expect(() => core.parse(2)).toThrow(TypeError)
  expect(core.parseInline('**x**').children[0].kind).toBe(names.Strong)
  expect(core.parse('\ufefftext🦀').source).toBe('\ufefftext🦀')
  const hostile = [
    '['.repeat(5000),
    '> '.repeat(300),
    '!{'.repeat(15000),
    '*'.repeat(50000),
    ':'.repeat(50000),
    ('[a]: "' + 'x'.repeat(200) + '\n').repeat(200),
    '\t'.repeat(65536),
    '> '.repeat(60) + '\t'.repeat(60000),
    '- > '.repeat(30) + '\t'.repeat(60000)
  ]
  const depthError = captureError(() =>
    core.parse('!!'.repeat(100) + 'deep' + '!!'.repeat(100))
  )
  expect(depthError).toMatchObject({ cause: { resource: 'depth' } })
  for (const source of hostile) {
    try {
      expect(core.parse(source).source).toBe(source)
    } catch (e) {
      expect(e).toBeInstanceOf(Error)
      expect((e as { cause: { code: string } }).cause.code).toBe(
        'resource_limit'
      )
    }
    expect(core.parse('after').children[0].children[0].data.value).toBe('after')
  }
  const columns = 7500
  const outputError = captureError(() =>
    core.parse(
      '|'.repeat(columns + 1) +
        '\n' +
        '|-'.repeat(columns) +
        '|\n' +
        '|'.repeat(columns + 1)
    )
  )
  expect(outputError).toMatchObject({ cause: { resource: 'output_bytes' } })
  expect(core.parse('after').source).toBe('after')
})

test('artifact pairing, preset selection, disposal and isolated results', async () => {
  for (const bad of [
    new Uint8Array([1, 2, 3]),
    new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])
  ])
    await expect(
      (async () => {
        const r = await createRuntime(bad)
        try {
          r.createParser(presets.traq.v1)
        } finally {
          r.dispose()
        }
      })()
    ).rejects.toThrow()
  const runtime = await createRuntime(bytes)
  expect(() => runtime.createParser('traq.invalid')).toThrow(/Markdown:/)
  const traq = runtime.createParser(presets.traq.v1)
  const common = runtime.createParser(presets.commonmark)
  let replacement
  try {
    const first = traq.parseInline(':stamp:')
    expect(first.children[0].kind).toBe(names.Stamp)
    expect(isKnownNode(first.children[0])).toBeTruthy()
    expect(
      isKnownNode({ ...first.children[0], kind: 'future::Node' })
    ).toBeFalsy()
    expect(common.parseInline(':stamp:').children[0].kind).toBe(names.Text)
    traq.parse('another')
    expect(first.source).toBe(':stamp:')
    traq.dispose()
    traq.dispose()
    expect(() => traq.parse('closed')).toThrow(/disposed/)
    expect(common.parse('still open').source).toBe('still open')
    replacement = runtime.createParser(presets.traq.v1)
    expect(replacement.parseInline(':stamp:').children[0].kind).toBe(
      names.Stamp
    )
  } finally {
    traq.dispose()
    runtime.dispose()
    expect(() => common.parse('closed')).toThrow(/disposed/)
    expect(() => replacement.parse('closed')).toThrow(/disposed/)
    expect(() => runtime.createParser(presets.commonmark)).toThrow(/disposed/)
    runtime.dispose()
  }
})

test('raw ABI validates UTF-8, preset and mode; linear memory is bounded', async () => {
  const { instance } = await WebAssembly.instantiate(bytes, {})
  const wasm = instance.exports,
    encoder = new TextEncoder(),
    decoder = new TextDecoder()
  const call = (operation, input, mode = 0) => {
    const encoded = typeof input === 'string' ? encoder.encode(input) : input
    const pointer = wasm.input_ptr(encoded.length)
    new Uint8Array(wasm.memory.buffer, pointer, encoded.length).set(encoded)
    const length =
      operation === 'configure' ? wasm.configure() : wasm.parse(mode)
    return JSON.parse(
      decoder.decode(
        new Uint8Array(wasm.memory.buffer, wasm.output_ptr(), length)
      )
    )
  }
  expect(wasm.abi_version()).toBe(3)
  expect(call('configure', 'traq.bad').error).toBeTruthy()
  expect(call('configure', 'traq.v1').configured).toBe(buildId)
  expect(call('parse', new Uint8Array([255]))).toEqual({
    error: { code: 'invalid_utf8' }
  })
  expect(call('parse', 'x', 99).error).toBeTruthy()
  expect(call('parse', 'ok').document.source).toBe('ok')
  const pages = wasm.memory.buffer.byteLength / 65536
  expect(wasm.memory.grow(512 - pages)).toBe(pages)
  expect(() => wasm.memory.grow(1)).toThrow(RangeError)
})

test('Go and TypeScript fixtures retain the Rust AST for blocks and inlines', async () => {
  const runtime = await createRuntime(bytes)
  const parser = runtime.createParser(presets.traq.v1)
  const commonmark = JSON.parse(
    await file(
      new URL('../../tests/fixtures/commonmark-0.31.2.json', import.meta.url)
    ).text()
  )
  try {
    for (const fixtureName of ['traq-v1-commonmark', 'traq-v1-extensions']) {
      const cases = JSON.parse(
        await file(
          new URL(
            '../../tests/fixtures/' + fixtureName + '.json',
            import.meta.url
          )
        ).text()
      )
      for (const fixture of cases)
        for (const [mode, method] of [
          ['block', 'parse'],
          ['inline', 'parseInline']
        ]) {
          const expected = fixture.expected[mode]
          const source =
            fixture.source ??
            commonmark.find(c => c.example === fixture.example).markdown
          if ('Ok' in expected)
            expect(parser[method](source)).toEqual(expected.Ok)
          else {
            const error = captureError(() => parser[method](source))
            expect((error as { cause: unknown })?.cause).toEqual(expected.Err)
          }
        }
    }
  } finally {
    runtime.dispose()
  }
})

test('Wasm input views respect their byte range and are copied before async work', async () => {
  const padded = new Uint8Array(bytes.length + 2)
  padded[0] = 99
  padded.set(bytes, 1)
  padded[padded.length - 1] = 99
  const view = padded.subarray(1, padded.length - 1)
  const pending = createRuntime(view)
  view.fill(0)
  const runtime = await pending
  const parser = runtime.createParser(presets.traq.v1)
  try {
    expect(parser.parse('copied').source).toBe('copied')
  } finally {
    runtime.dispose()
  }
})

test('a valid parser Wasm from a different Rust build is rejected', async () => {
  const other = bytes.slice()
  const id = new TextEncoder().encode(buildId)
  const indexOfBytes = (source, target, start = 0) => {
    for (
      let position = start;
      position <= source.length - target.length;
      position++
    ) {
      let matches = true
      for (let offset = 0; offset < target.length; offset++)
        if (source[position + offset] !== target[offset]) {
          matches = false
          break
        }
      if (matches) return position
    }
    return -1
  }
  let count = 0
  for (
    let position = indexOfBytes(other, id);
    position !== -1;
    position = indexOfBytes(other, id, position + id.length)
  ) {
    other.fill(48, position, position + id.length)
    count++
  }
  expect(count).toBeGreaterThan(0)
  const runtime = await createRuntime(other)
  try {
    expect(() => runtime.createParser(presets.traq.v1)).toThrow(
      /does not match/
    )
  } finally {
    runtime.dispose()
  }
})
