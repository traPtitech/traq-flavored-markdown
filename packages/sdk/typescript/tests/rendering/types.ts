import * as rendering from '@traq-flavored-markdown/sdk/renderer'
import {
  isKnownNode,
  names
} from '@traq-flavored-markdown/commonmark-plugin/nodes'
import { plugin } from '@traq-flavored-markdown/commonmark-plugin/renderer'
import { Plugin as Declaration } from '@traq-flavored-markdown/core/definitions'
import {
  Plugin,
  PresetBuilder,
  type RenderContext,
  renderer
} from '@traq-flavored-markdown/core/renderer'
import {
  type Document,
  createRuntime,
  presets
} from '@traq-flavored-markdown/sdk'
import type { Store } from '@traq-flavored-markdown/traq-plugin/renderer'

const runtime = await createRuntime(new Uint8Array())
const parser = runtime.createParser(presets.traq.v1)
const view = renderer(rendering.htmlPreset())
const directView = rendering.html()
const result: string = view.render(parser.parse('text'))
const messageView = rendering.messageRenderers({
  origin: 'https://q.example.test'
})
const messageHtml: string = messageView.standard.render(
  parser.parse('text')
).renderedText
const condensedHtml: string = messageView.condensed.render(
  parser.parse('text')
).renderedText

const openDocument = {} as Document<true>
const openResult: string = view.render(openDocument)
const custom = plugin().replace(names.Link, (node, context) => {
  if (isKnownNode(node) && node.kind === names.Link) {
    const destination: string = node.data.destination
    return context.escape(destination) + context.render(node.children)
  }
  return context.fallback(node)
})
const builder = new PresetBuilder().add(custom)
const declaration = Declaration.group('custom').new('annotation')
builder.add(
  new Plugin(declaration).on('custom::annotation', (node, context) =>
    context.render(node.children)
  )
)
const store: Store = {
  getMe: () => ({ id: 'me' }),
  generateUserHref: id => '#' + id
}
renderer(
  rendering.htmlPreset({
    store,
    math: tex => tex,
    highlight: code => ({ kind: 'content', html: code })
  })
)

// @ts-expect-error handlers return HTML strings
new Plugin(declaration).on('invalid', () => [])
// @ts-expect-error presets have runtime identity
renderer({})
// @ts-expect-error shared declarations are explicit objects
new Plugin('name')
declare const context: RenderContext
const renderedChildren: string = context.render([])
void [
  result,
  messageHtml,
  condensedHtml,
  openResult,
  renderedChildren,
  directView
]

// @ts-expect-error html returns a renderer; use htmlPreset for composition.
renderer(rendering.html())

// @ts-expect-error Choose a message presentation before rendering.
messageView.render(parser.parse('text'))
// @ts-expect-error Each message renderer exposes only render.
messageView.condensed.renderInline(parser.parse('text'))

// @ts-expect-error Core renderers also expose only render.
view.renderInline(parser.parseInline('text'))

// @ts-expect-error Child rendering has no inline mode.
context.inline([])
// @ts-expect-error Child rendering has no block mode.
context.blocks([])
