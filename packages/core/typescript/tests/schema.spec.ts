import {
  DocumentContext,
  DocumentSchema,
  DocumentValidationError,
  defineNode,
  documentLimits
} from '@traq-flavored-markdown/core'
import { PluginDeclaration } from '@traq-flavored-markdown/core/definitions'
import {
  PresetBuilder,
  RenderPlugin,
  createRenderer
} from '@traq-flavored-markdown/core/renderer'
import { expect, test } from 'bun:test'

test('document contracts remain active when no renderer handles their nodes', () => {
  const text = defineNode<{ kind: 'text'; data: { value: string } }>(
    'text',
    data =>
      typeof data === 'object' &&
      data !== null &&
      'value' in data &&
      typeof data.value === 'string',
    { role: 'inline', children: { kind: 'leaf' } }
  )
  const schema = new DocumentSchema([text])
  const renderer = createRenderer(new PresetBuilder().build(), { schema })
  const input = {
    source: 'text',
    children: [
      { kind: 'text', data: { value: 42 }, span: { start: 0, end: 4 } }
    ]
  }
  expect(() => renderer.render(input)).toThrow(DocumentValidationError)
  expect(() => renderer.render(input)).toThrow(/payload/)
})

test('document boundary errors identify the failing source path and resource', () => {
  for (const [input, options, detail] of [
    [
      {
        source: 'é',
        children: [{ kind: 'x', data: {}, span: { start: 1, end: 2 } }]
      },
      {},
      { code: 'invalid_document', path: '$.children[0].span' }
    ],
    [
      {
        source: '',
        children: [
          {
            kind: 'x',
            data: { nested: { value: '\ud800' } },
            span: { start: 0, end: 0 }
          }
        ]
      },
      {},
      {
        code: 'invalid_document',
        path: '$.children[0].data["nested"]["value"]'
      }
    ],
    [
      { source: 'large', children: [] },
      { limits: { ...documentLimits, sourceBytes: 1 } },
      { code: 'resource_limit', path: '$.source', resource: 'source_bytes' }
    ]
  ] as const) {
    let failure: unknown
    try {
      new DocumentContext(input, options)
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(DocumentValidationError)
    expect(failure).toMatchObject(detail)
  }
})

test('schemas own their contracts and editing requires an explicit independent draft', () => {
  let validations = 0
  const text = defineNode<{ kind: 'text'; data: { value: string } }>(
    'text',
    data => {
      validations++
      return (
        typeof data === 'object' &&
        data !== null &&
        'value' in data &&
        typeof data.value === 'string'
      )
    }
  )
  const schema = new DocumentSchema([text])
  const document = schema.document({
    source: '',
    children: [
      { kind: 'text', data: { value: 'original' }, span: { start: 0, end: 0 } }
    ]
  })
  expect(schema.document(document)).toBe(document)
  expect(schema.withUnknownNodes().document(document)).toBe(document)
  expect(validations).toBe(1)
  const draft = document.toMutable()
  draft.children[0].data.value = 'changed'
  expect(document.document.children[0].data.value).toBe('original')
  expect(schema.document(draft).document.children[0].data.value).toBe('changed')
  expect(validations).toBe(2)
})

test('unknown node policy and typed renderer requirements are explicit', () => {
  const text = defineNode<{ kind: 'text'; data: string }>(
    'text',
    data => typeof data === 'string'
  )
  const schema = new DocumentSchema([text])
  const unknown = {
    source: 'extension',
    children: [{ kind: 'extension', data: {}, span: { start: 0, end: 9 } }]
  }
  expect(() => schema.document(unknown)).toThrow(/Unknown node/)
  expect(
    schema.withUnknownNodes().document(unknown).document.children[0].kind
  ).toBe('extension')
  let calls = 0
  const plugin = new RenderPlugin(new PluginDeclaration('typed')).withHandler(
    text,
    node => {
      calls++
      return node.data
    }
  )
  const renderer = createRenderer(new PresetBuilder().add(plugin).build())
  const input = {
    source: '',
    children: [{ kind: 'text', data: 'value', span: { start: 0, end: 0 } }]
  }
  expect(() => renderer.render(input)).toThrow(/requires a document schema/)
  const sameKindWithDifferentPayload = defineNode<{ kind: 'text'; data: number }>(
    'text', data => typeof data === 'number'
  )
  const unrelated = new DocumentSchema([sameKindWithDifferentPayload]).document({
    source: '', children: [{ kind: 'text', data: 42, span: { start: 0, end: 0 } }]
  })
  expect(() => renderer.render(unrelated)).toThrow(/requires a document schema/)
  expect(calls).toBe(0)
  expect(renderer.render(schema.document(input))).toBe('value')
})
