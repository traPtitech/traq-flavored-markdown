import {
  DocumentSchema,
  DocumentValidationError,
  defineNode
} from '@traq-flavored-markdown/core'
import { PluginDeclaration } from '@traq-flavored-markdown/core/definitions'
import {
  createRenderer,
  PresetBuilder,
  RenderPlugin
} from '@traq-flavored-markdown/core/renderer'
import { expect, test } from 'bun:test'

test('document contracts remain active when no renderer handles their nodes', () => {
  const text = defineNode<{ kind: 'text'; data: { value: string } }>(
    'text',
    data => typeof data === 'object' && data !== null &&
      'value' in data && typeof data.value === 'string',
    { role: 'inline', children: { kind: 'leaf' } }
  )
  const schema = new DocumentSchema([text])
  const renderer = createRenderer(new PresetBuilder().build(), { schema })
  const input = {
    source: 'text',
    children: [{ kind: 'text', data: { value: 42 }, span: { start: 0, end: 4 } }]
  }
  expect(() => renderer.render(input)).toThrow(DocumentValidationError)
  expect(() => renderer.render(input)).toThrow(/payload/)
})

test('schemas own their contracts and editing requires an explicit independent draft', () => {
  let validations = 0
  const text = defineNode<{ kind: 'text'; data: { value: string } }>(
    'text',
    data => {
      validations++
      return typeof data === 'object' && data !== null &&
        'value' in data && typeof data.value === 'string'
    }
  )
  const schema = new DocumentSchema([text])
  const document = schema.document({
    source: '',
    children: [{ kind: 'text', data: { value: 'original' }, span: { start: 0, end: 0 } }]
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
  const text = defineNode<{ kind: 'text'; data: string }>('text', data => typeof data === 'string')
  const schema = new DocumentSchema([text])
  const unknown = {
    source: 'extension',
    children: [{ kind: 'extension', data: {}, span: { start: 0, end: 9 } }]
  }
  expect(() => schema.document(unknown)).toThrow(/Unknown node/)
  expect(schema.withUnknownNodes().document(unknown).document.children[0].kind).toBe('extension')
  let calls = 0
  const plugin = new RenderPlugin(new PluginDeclaration('typed')).withHandler(text, node => {
    calls++
    return node.data
  })
  const renderer = createRenderer(new PresetBuilder().add(plugin).build())
  const input = { source: '', children: [{ kind: 'text', data: 'value', span: { start: 0, end: 0 } }] }
  expect(() => renderer.render(input)).toThrow(/requires a document schema/)
  expect(calls).toBe(0)
  expect(renderer.render(schema.document(input))).toBe('value')
})
