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
import {
  type ReferenceData,
  names
} from '@traq-flavored-markdown/traq-plugin/nodes'

const runtime = await createRuntime(new Uint8Array())
const parser = runtime.createParser(presets.traq.v1)
const document: Document = parser.parse('text')
for (const node of document.children)
  if (node.kind === names.Reference) {
    const reference: ReferenceData = node.data
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
const mentions: string[] = output.references.mentions
const browserRuntime = await loadRuntime()
browserRuntime.createParser(presets.traq.v1)
if (isBrowserPreset(storedGrammarVersion))
  browserRuntime.createParser(storedGrammarVersion)
browserRuntime.createExtractor({ origin: '' })
void mentions
// @ts-expect-error The SDK owns the shared browser Runtime's lifetime.
browserRuntime.dispose()
// @ts-expect-error Extractor has no host AST parsing API
extractor.parse('x')
// @ts-expect-error Options are generated from Rust
runtime.createExtractor({ origin: 4 })
runtime.dispose()
