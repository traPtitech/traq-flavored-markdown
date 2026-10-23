import * as rendering from '@traq-flavored-markdown/sdk/renderer'
import {
  isKnownNode,
  names
} from '@traq-flavored-markdown/commonmark-plugin/nodes'
import { plugin } from '@traq-flavored-markdown/commonmark-plugin/renderer'
import { PluginDeclaration as Declaration } from '@traq-flavored-markdown/core/definitions'
import {
  PresetBuilder,
  type RenderContext,
  RenderPlugin,
  renderer
} from '@traq-flavored-markdown/core/renderer'
import {
  type Document,
  createRuntime,
  presets
} from '@traq-flavored-markdown/sdk'
import type { ReferenceResolver } from '@traq-flavored-markdown/traq-plugin/renderer'

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
).html
const condensedHtml: string = messageView.condensed.render(
  parser.parse('text')
).html

const openDocument = {} as Document<true>
const openResult: string = view.render(openDocument)
const custom = plugin().replace(names.Link, (node, context) => {
  if (isKnownNode(node) && node.kind === names.Link) {
    const destination: string = node.data.destination
    return context.escape(destination) + context.renderChildren()
  }
  return context.fallback(node)
})
const builder = new PresetBuilder().add(custom)
const declaration = Declaration.group('custom').plugin('annotation')
builder.add(
  new RenderPlugin(declaration).on('custom::annotation', (node, context) =>
    context.renderChildren()
  )
)
const resolve: ReferenceResolver = ({ id }) => ({
  href: '#' + id,
  highlight: id === 'me'
})
renderer(
  rendering.htmlPreset({
    references: { resolve },
    math: { render: tex => tex },
    code: { highlight: code => ({ kind: 'content', html: code }) }
  })
)

// @ts-expect-error handlers return HTML strings
new RenderPlugin(declaration).on('invalid', () => [])
// @ts-expect-error presets have runtime identity
renderer({})
// @ts-expect-error shared declarations are explicit objects
new RenderPlugin('name')
declare const context: RenderContext
const renderedChildren: string = context.renderChildren()
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

const bothViews = messageView.render(parser.parse('text'))
const prepared = messageView.prepare(parser.parse('text'))
void [bothViews.standard.html, prepared.condensed().html]
// @ts-expect-error Each message renderer exposes only render.
messageView.condensed.renderInline(parser.parse('text'))

// @ts-expect-error Core renderers also expose only render.
view.renderInline(parser.parseInline('text'))

// @ts-expect-error Child rendering has no inline mode.
context.inline([])
// @ts-expect-error Child rendering has no block mode.
context.blocks([])
