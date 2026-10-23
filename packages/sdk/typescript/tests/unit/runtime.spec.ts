import { documentLimits as coreDocumentLimits } from '@traq-flavored-markdown/core'
import { expect, test } from 'bun:test'

import { abiExports } from '../../src/generated/abi.js'
import {
  contractId,
  documentLimits,
  inputBytes,
  outputBytes
} from '../../src/generated/artifact.js'
import { MarkdownError } from '../../src/runtime/errors.js'
import { createRuntime } from '../../src/runtime/index.js'

// A tiny real module makes malformed replies and traps independent of Rust builds.
function moduleBytes(reply: string | 'trap', id = contractId): Uint8Array {
  const encoder = new TextEncoder()
  const leb = (value: number, signed = false): number[] => {
    const output: number[] = []
    for (;;) {
      const byte = value & 127
      value >>= 7
      const done = signed
        ? (value === 0 && !(byte & 64)) || (value === -1 && !!(byte & 64))
        : value === 0
      output.push(byte | (done ? 0 : 128))
      if (done) return output
    }
  }
  const text = (value: string) => {
    const bytes = [...encoder.encode(value)]
    return [...leb(bytes.length), ...bytes]
  }
  const binary = [0, 97, 115, 109, 1, 0, 0, 0]
  const section = (id: number, bytes: number[]) =>
    binary.push(id, ...leb(bytes.length), ...bytes)
  section(1, [2, 0x60, 0, 1, 0x7f, 0x60, 1, 0x7f, 1, 0x7f])
  const functions = Object.entries(abiExports)
  section(3, [
    functions.length,
    ...functions.map(([, signature]) => signature.params.length)
  ])
  section(5, [1, 0, 1])
  section(6, [1, 0x7f, 1, 0x41, 0, 0x0b])
  section(7, [
    functions.length + 1,
    ...functions.flatMap(([name], index) => [...text(name), 0, index]),
    ...text('memory'),
    2,
    0
  ])
  const contract = JSON.stringify({
    contractId: id,
    abiVersion: 1,
    limits: { inputBytes, outputBytes, document: documentLimits }
  })
  const configured = JSON.stringify({ ok: { contractId: id } })
  const constant = (value: number) => [0x41, ...leb(value, true)]
  const result = (pointer: number, content: string) => [
    ...constant(pointer),
    0x24,
    0,
    ...constant(encoder.encode(content).length)
  ]
  const bodies = functions.map(([name]) => {
    let code: number[]
    if (name === 'input_ptr') code = constant(1024)
    else if (name === 'output_ptr') code = [0x23, 0]
    else if (name === 'contract_ptr') code = constant(4096)
    else if (name === 'contract_len')
      code = constant(encoder.encode(contract).length)
    else if (name.startsWith('configure')) code = result(8192, configured)
    else code = reply === 'trap' ? [0x00] : result(16384, reply)
    const body = [0, ...code, 0x0b]
    return [...leb(body.length), ...body]
  })
  section(10, [bodies.length, ...bodies.flat()])
  const data = (pointer: number, value: string) => [
    0,
    ...constant(pointer),
    0x0b,
    ...text(value)
  ]
  section(11, [
    3,
    ...data(4096, contract),
    ...data(8192, configured),
    ...data(16384, reply)
  ])
  return new Uint8Array(binary)
}

const thrown = (run: () => unknown): MarkdownError => {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(MarkdownError)
    return error as MarkdownError
  }
  throw new Error('Expected MarkdownError')
}

test('transport faults close one instance and preserve structured operation context', async () => {
  for (const reply of [
    'trap',
    '{',
    '{}',
    '{"ok":{},"error":{}}',
    '{"ok":{}}',
    '{"error":{"code":"made_up","message":"bad"}}'
  ]) {
    const runtime = await createRuntime(moduleBytes(reply))
    const parser = runtime.createParser('commonmark')
    expect(thrown(() => parser.parse('x'))).toMatchObject({
      code: 'transport_error',
      operation: 'parse'
    })
    expect(thrown(() => parser.parse('again')).code).toBe('disposed')
    runtime.dispose()
  }
})

test('valid domain errors and host request errors leave the processor reusable', async () => {
  const detail = {
    code: 'invalid_document',
    message: 'Invalid node',
    path: '$.children[0]',
    span: { start: 1, end: 2 },
    phase: 'inline',
    rule: 'custom',
    payload_type: 'example.Text'
  }
  const runtime = await createRuntime(
    moduleBytes(JSON.stringify({ error: detail }))
  )
  const parser = runtime.createParser('commonmark')
  expect(thrown(() => parser.parse('\ud800')).code).toBe('invalid_utf8')
  // @ts-expect-error Exercise a JavaScript caller with an invalid input type.
  expect(thrown(() => parser.parse(1)).code).toBe('invalid_request')
  for (let attempt = 0; attempt < 2; attempt++) {
    const error = thrown(() => parser.parse('x'))
    expect(error).toMatchObject({
      code: detail.code,
      path: detail.path,
      span: detail.span,
      phase: detail.phase,
      rule: detail.rule,
      payloadType: detail.payload_type
    })
    expect(error.withOperation('another')).toMatchObject({
      phase: detail.phase,
      rule: detail.rule,
      payloadType: detail.payload_type,
      operation: 'another'
    })
    expect(error.cause).toEqual(detail)
  }
  runtime.dispose()
  expect(thrown(() => parser.parse('x')).code).toBe('disposed')
})

test('successful values and contract mismatches are checked before reaching callers', async () => {
  const runtime = await createRuntime(
    moduleBytes('{"ok":{"source":"x","children":[]}}')
  )
  expect(runtime.createParser('commonmark').parse('x')).toEqual({
    source: 'x',
    children: []
  })
  runtime.dispose()
  const stale = await createRuntime(moduleBytes('{}', 'stale'))
  expect(thrown(() => stale.createParser('commonmark')).code).toBe(
    'contract_mismatch'
  )
  stale.dispose()
})

test('fused processing rejects malformed members before exposing a result', async () => {
  const extraction = {
    attachments: [],
    citations: [],
    messageText: 'x',
    referenceEmbedding: { candidates: [], unembeddedText: 'x' },
    references: {
      channelLinks: [],
      embeddings: [],
      groupMentions: [],
      mentions: []
    }
  }
  const result = {
    document: { source: 'x', children: [] },
    extraction,
    plainText: 'x'
  }
  const runtime = await createRuntime(
    moduleBytes(JSON.stringify({ ok: result }))
  )
  expect(runtime.createProcessor('commonmark').process('x')).toEqual(result)
  runtime.dispose()
  for (const invalid of [
    { ...result, document: null },
    { ...result, extraction: {} },
    { ...result, plainText: null }
  ]) {
    const runtime = await createRuntime(
      moduleBytes(JSON.stringify({ ok: invalid }))
    )
    const processor = runtime.createProcessor('commonmark')
    expect(thrown(() => processor.process('x')).code).toBe('transport_error')
    expect(thrown(() => processor.process('x')).code).toBe('disposed')
    runtime.dispose()
  }
})

test('host bounds requests before transport and preserves operation details on reusable instances', async () => {
  expect(coreDocumentLimits).toEqual(documentLimits)
  const runtime = await createRuntime(moduleBytes('{"ok":"rendered"}'))
  const renderer = runtime.createPlainTextRenderer()
  let reads = 0
  const document = Object.defineProperty({ children: [] }, 'source', {
    enumerable: true,
    get() {
      reads++
      return ''
    }
  })
  expect(thrown(() => renderer.render(document as never))).toMatchObject({
    code: 'invalid_request',
    operation: 'render'
  })
  expect(reads).toBe(0)
  expect(
    thrown(() => renderer.render({ source: '\ud800', children: [] }))
  ).toMatchObject({ code: 'invalid_utf8', operation: 'render' })
  expect(renderer.render({ source: '', children: [] })).toBe('rendered')
  runtime.dispose()

  const parsing = await createRuntime(
    moduleBytes('{"ok":{"source":"","children":[]}}')
  )
  const parser = parsing.createParser('commonmark')
  for (const source of [
    'x'.repeat(documentLimits.sourceBytes + 1),
    '猫'.repeat(Math.floor(documentLimits.sourceBytes / 3) + 1)
  ])
    expect(thrown(() => parser.parse(source))).toMatchObject({
      code: 'resource_limit',
      resource: 'source_bytes',
      operation: 'parse'
    })
  expect(parser.parse('')).toEqual({ source: '', children: [] })
  parsing.dispose()
})
