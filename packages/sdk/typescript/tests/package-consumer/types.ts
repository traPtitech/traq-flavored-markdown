import { type Extraction } from '@traq-markdown-engine/sdk'
import {
  type Document,
  type Node,
  createRuntime,
  isKnownNode,
  presets
} from '@traq-markdown-engine/sdk'
import { loadRuntime } from '@traq-markdown-engine/sdk/browser'
import {
  type ReferenceData,
  names
} from '@traq-markdown-engine/traq-plugin/nodes'

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
runtime.createParser(storedGrammarVersion)
const extractor = runtime.createExtractor({ origin: '' })
const output: Extraction = extractor.extract(document)
const mentions: string[] = output.references.mentions
const browserRuntime = await loadRuntime()
browserRuntime.createParser(presets.traq.v1)
browserRuntime.createExtractor({ origin: '' })
void mentions
// @ts-expect-error The SDK owns the shared browser Runtime's lifetime.
browserRuntime.dispose()
// @ts-expect-error Extractor has no host AST parsing API
extractor.parse('x')
// @ts-expect-error Options are generated from Rust
runtime.createExtractor({ origin: 4 })
runtime.dispose()
