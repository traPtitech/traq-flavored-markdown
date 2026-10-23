import { createRuntime, presets } from '../../../packages/sdk/dist/index.js'
import { schema } from '../../../packages/sdk/dist/generated/nodes.js'
import { withDefaultAdapters } from '../../../packages/sdk/dist/adapters/index.js'
import { createHtmlRenderer, messageRenderers } from '../../../packages/sdk/dist/renderer/index.js'
import '../../../packages/sdk/dist/index.css'

const response = await fetch('/packages/sdk/dist/parser.wasm')
if (!response.ok) throw new Error('Wasm fixture unavailable')
const runtime = await createRuntime(new Uint8Array(await response.arrayBuffer()))
const parser = runtime.createParser(presets.traq.v1)
const renderer = createHtmlRenderer(withDefaultAdapters({
  images: { validate: value => value.startsWith('/tests/browser/') }
}))
const gallery = document.querySelector('#gallery')!
const append = (id: string, html: string, className = 'markdown-body') => {
  const section = document.createElement('section')
  section.id = id
  section.className = className
  section.innerHTML = html
  gallery.append(section)
  return section
}
const samples = {
  blocks: '# Heading\n\n- first\n- second\n\n> quoted\n\n##### Small heading\n\n###### Smallest heading',
  table: '| left | right |\n| :--- | ---: |\n| a | b |\n| c | d |',
  inline: '**bold** *italic* ~~gone~~ ==marked== !!**secret**!! :0xff0000:',
  math: '$x^2$\n\n```js\nconst answer = 42\n```',
  safe: '<img src=x onerror="document.body.dataset.injected=1"> [unsafe](javascript:alert(1)) [safe](https://example.test)',
  image: '![alternative](/tests/browser/fixtures/pixel.svg)'
}
for (const [id, source] of Object.entries(samples)) append(id, renderer.render(parser.parse(source)))

const messages = messageRenderers({ origin: 'https://q.example.test', ...withDefaultAdapters() })
const prepared = messages.prepare(parser.parse('hello\nhttps://q.example.test/files/00000000-0000-0000-0000-000000000001'))
append('standard', prepared.standard().html)
append('condensed', prepared.condensed().html, 'markdown-inline-body')
append('cards', prepared.standard().cards.map(card => card.type).join(', '), '')

const original = parser.parseInline('original')
const originalView = append('original', renderer.render(original))
const editedView = append('edited', '')
document.querySelector('#edit')!.addEventListener('click', () => {
  const draft = original.toMutable()
  draft.source = 'modified'
  const text = draft.children[0]
  if (text.kind !== 'commonmark.text') throw new Error('Expected text fixture')
  text.data.value = 'modified'
  editedView.innerHTML = renderer.render(schema.document(draft))
  originalView.innerHTML = renderer.render(original)
})
document.querySelector('#status')!.textContent = 'Ready'
