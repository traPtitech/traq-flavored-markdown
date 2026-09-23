# SDK: traQ Markdown

This package assembles the Markdown grammar used by traQ and distributes it for
Rust, WebAssembly, TypeScript, and Go. Rust owns grammar definitions, AST
contracts, and validation; the SDK exposes the supported presets and host APIs.

- npm: `@traq-flavored-markdown/sdk`
- Go module: `github.com/traPtitech/traq-flavored-markdown/packages/sdk/go`

This package combines the core, CommonMark plugin, and traQ plugin layers for
traQ.

The TypeScript `renderer` preset applies traQ display policy to CommonMark
nodes: raw HTML is escaped, links use a restricted scheme list (including
`tel`, `sms`, and `geo`), and rejected links display their escaped Markdown
source. The CommonMark plugin's `specHtml()` preset is for specification output
and can emit unsafe HTML; it is not used for message display.

## Contents

| Location                      | Purpose                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| `crates/grammar`              | Published grammar presets                                     |
| `crates/processing`           | traQ plain-text rendering, extraction, and embedding policies |
| `crates/wasm`                 | Wasm interface for the shipped grammar and processing APIs    |
| `typescript`, `go`, `scripts` | Host bindings and generated contract types                    |

Build artifacts are written to `dist/`; generated TypeScript and Go sources are
committed and must be regenerated from their Rust contracts.

## Parse Markdown

Create parsers for the presets your application supports. A runtime compiles
Wasm once, then gives each parser and extractor an independent instance.

### Browser TypeScript

```ts
import { loadRuntime, presets } from '@traq-flavored-markdown/sdk/browser'

const runtime = await loadRuntime()
const parser = runtime.createParser(presets.traq.v1)
const document = parser.parse('**hello** :stamp:')
const inline = parser.parseInline('**hello**')
parser.dispose()
```

`loadRuntime` fetches the packaged Wasm once and retains its shared runtime for
the page. It deliberately exposes no runtime `dispose`; dispose individual
parsers and extractors when they are no longer needed. Node payload types and
optional guards are exported by the CommonMark and traQ plugin packages.
`@traq-flavored-markdown/sdk/nodes` exports the complete node-name catalog.

### Bun and other TypeScript hosts

```ts
import { createRuntime, presets } from '@traq-flavored-markdown/sdk'

const runtime = await createRuntime(wasmBytes)
try {
  const parser = runtime.createParser(presets.traq.v1)
  const document = parser.parse('**hello** :stamp:')
  const inline = parser.parseInline('**hello**')
} finally {
  runtime.dispose()
}
```

`wasmBytes` is a `Uint8Array`. With Bun, load
`@traq-flavored-markdown/sdk/parser.wasm` with `Bun.file(...).bytes()`. Supply
the bytes directly in hosts that do not use the browser entrypoint.

### Go

```go
import markdown "github.com/traPtitech/traq-flavored-markdown/packages/sdk/go"

runtime, err := markdown.NewBundledRuntime(ctx)
if err != nil { return err }
defer runtime.Close(ctx)

parser, err := runtime.NewParser(ctx, markdown.PresetTraqV1)
if err != nil { return err }
defer parser.Close(ctx)

document, err := parser.Parse(ctx, "**hello** :stamp:")
if err != nil { return err }
```

The Go module embeds the matching Wasm, so `NewBundledRuntime` works without a
separate artifact or npm package. Use `NewRuntime(ctx, wasmBytes)` when loading a
matching Wasm artifact yourself. The four Go modules are tagged at the same
version as the npm packages; install the SDK with
`go get github.com/traPtitech/traq-flavored-markdown/packages/sdk/go@v0.1.4`
for the first Go release, then use the matching version for later releases.

`Parse` and `ParseInline` return `*markdown.Document`; concrete `Node.Data`
types are generated from Rust contracts. Calls to one parser are serialized. For
parallel parsing, create multiple parsers from the same runtime. Closing a
runtime closes all of its parsers, extractors, and renderers.

## Render and extract a document

Parsing produces a `Document` that can be passed directly to other consumers;
none of them parses the Markdown source again. The TypeScript renderer works on
the host, while the Go plain-text renderer and extractors call the native Rust
implementation through the same runtime.

```ts
import '@traq-flavored-markdown/sdk/index.css'
import { messageRenderers } from '@traq-flavored-markdown/sdk/renderer'

const parser = runtime.createParser(presets.traq.v1)
const extractor = runtime.createExtractor({ origin: 'https://q.example.test' })
const view = messageRenderers({ origin: 'https://q.example.test' })
const document = parser.parse('**hello** !!secret!!')

const extraction = extractor.extract(document)
const rendered = view.standard.render(document)
const html = rendered.renderedText
```

`messageRenderers` builds `standard` and `condensed` views. Each `render` call
returns `rawText`, `renderedText`, and `embeddings`; the extractor returns
source-preserving message text, references, attachment and citation IDs, and an
embedding plan. Complete Rust, Go, and TypeScript programs are in
[examples](examples/README.md).

## Grammar versions

Grammar versions identify the rules used to write a message. Store that value
with the source and create a parser for the stored version when reading it back.
Unknown versions fail rather than silently selecting a newer grammar.
In TypeScript, check a stored string with `isPreset(version)` before passing it
to `createParser`; the guard narrows it to the generated `Preset` type.

`presets.traq.v1` and `PresetTraqV1` are generated from the Rust preset catalog.
Custom grammars are composed in Rust and published through that catalog; the
TypeScript and Go APIs intentionally do not mirror the Rust grammar builder.
When behavior changes, preserve the existing preset and add a new version rather
than changing how stored content is interpreted.
