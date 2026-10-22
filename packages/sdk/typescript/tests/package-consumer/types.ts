import { DocumentContext } from '@traq-flavored-markdown/core'
import { type Extraction } from '@traq-flavored-markdown/sdk'
import {
  type Document,
  type Node,
  createRuntime,
  isKnownNode,
  isPreset,
  presets
} from '@traq-flavored-markdown/sdk'
import {
  isPreset as isBrowserPreset,
  loadRuntime
} from '@traq-flavored-markdown/sdk/browser'
import { html as composeHtml } from '@traq-flavored-markdown/sdk/renderer/composition'
import {
  type Reference,
  names
} from '@traq-flavored-markdown/traq-plugin/nodes'

const runtime = await createRuntime(new Uint8Array())
const parser = runtime.createParser(presets.traq.v1)
const document: Document = parser.parse('text')
for (const node of document.children)
  if (node.kind === names.Reference) {
    const reference: Reference = node.data
    const id: string = reference.id
    void id
  }
declare const unknownNode: Node<true>
if (isKnownNode(unknownNode) && unknownNode.kind === names.Reference) {
  const id: string = unknownNode.data.id
  void id
}
declare const storedGrammarVersion: string
if (isPreset(storedGrammarVersion)) runtime.createParser(storedGrammarVersion)
// @ts-expect-error Stored strings must be checked against the generated catalog.
runtime.createParser(storedGrammarVersion)
const extractor = runtime.createExtractor({ origin: '' })
const output: Extraction = extractor.extract(document)
const plainText: string = runtime.createPlainTextRenderer().render(document)
const processed = runtime
  .createProcessor(presets.traq.v1, { whitespace: 'preserve' })
  .process('text')
const processedDocument: Document = processed.document
const snapshot = new DocumentContext(processedDocument)
runtime.createPlainTextRenderer().render(snapshot.document)
const customHtml: string = composeHtml({ math: { render: tex => tex } }).render(
  snapshot.document
)
const snapshotNode = snapshot.document.children[0]
if (isKnownNode(snapshotNode) && snapshotNode.kind === names.Stamp) {
  // @ts-expect-error generated guards preserve snapshot payload ownership
  snapshotNode.data.effects.animations.push('rotate')
}
runtime.createExtractor({})
const mentions: string[] = output.references.mentions
const browserRuntime = await loadRuntime()
browserRuntime.createParser(presets.traq.v1)
if (isBrowserPreset(storedGrammarVersion))
  browserRuntime.createParser(storedGrammarVersion)
browserRuntime.createExtractor({ origin: '' })
browserRuntime.createPlainTextRenderer({})
void [mentions, plainText, customHtml]
// @ts-expect-error The SDK owns the shared browser Runtime's lifetime.
browserRuntime.dispose()
// @ts-expect-error Extractor has no host AST parsing API
extractor.parse('x')
// @ts-expect-error Options are generated from Rust
runtime.createExtractor({ origin: 4 })
runtime.dispose()
