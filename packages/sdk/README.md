# SDK: traQ Markdown

This package assembles the Markdown grammar used by traQ and distributes it for
Rust, WebAssembly, TypeScript, and Go. Rust owns grammar definitions, AST
contracts, and validation; the SDK exposes the supported presets and host APIs.

- npm: `@traq-flavored-markdown/sdk`
- Go module: `github.com/traPtitech/traq-flavored-markdown/packages/sdk/go`

This package combines the core, CommonMark, extensions, and traQ plugin layers for
traQ.

The TypeScript `html()` renderer applies traQ display policy to CommonMark
nodes: raw HTML is escaped, links use a restricted scheme list (including
`tel`, `sms`, and `geo`), and rejected links display their escaped Markdown
source. The CommonMark plugin's `specHtml()` renderer is for specification output
and can emit unsafe HTML; it is not used for message display.

traQ's `spacing` syntax preserves additional blank lines with their source spans
and container structure. Empty quote visibility is a presentation choice: the
standard traQ renderer supplies a line break without inserting an AST node.
Links and both direct and reference images use CommonMark parsing. URL encoding
belongs to parsing; URL scheme and image domain restrictions belong to each
renderer. The standard traQ view displays HTTPS images from its allowed domains
and preserves escaped source for rejected images. Applications can supply
`images.validate` and `links.validate` independently. Explicit `undefined` options
use the same display defaults as omitted options.

## Contents

| Location                      | Purpose                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| `crates/features`             | Typed feature bindings and profile membership                 |
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
parsers, extractors, and plain-text renderers when they are no longer needed.
Node payload types and optional guards are exported by their plugin packages.
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
matching Wasm artifact yourself. The Go modules are tagged at the same
version as the npm packages; install the SDK with
`go get github.com/traPtitech/traq-flavored-markdown/packages/sdk/go@v0.1.4`
for the first Go release, then use the matching version for later releases.

`Parse` and `ParseInline` return `*markdown.Document`; concrete `Node.Data`
types are generated from Rust contracts. Calls to one parser are serialized. For
parallel parsing, create multiple parsers from the same runtime. Closing a
runtime closes all of its parsers, extractors, and renderers.

For repeated processing, `ParseValidated` and `ParseInlineValidated` return an
immutable `ValidatedDocument`. Pass it to `ExtractValidated` and
`RenderValidated` to reuse the owned wire snapshot. `ValidateDocument` snapshots
a mutable document after checking its complete tree and payloads. Invalid UTF-8,
missing wire fields, unordered or overlapping sibling spans, and spans that
split a UTF-8 character are rejected before consumers run. Source bytes,
including a leading BOM, CRLF, and NUL, are preserved.

Go failures expose `*markdown.Error` with a stable `Code` and optional
`Resource`, `Path`, `Offset`, `Span`, `Phase`, `Rule`, and `PayloadType`.
Use `errors.As` to inspect them.
Domain errors leave an instance usable; a Wasm trap or malformed response
closes that instance. A later call reports `disposed`.

The generated contract ID identifies ABI operations, request and response
schemas, node contracts, presets, and limits. Source provenance and the binary
digest are recorded separately, so a source-only refactor does not change
the semantic contract ID. Build through the shared SDK pipeline to pair Wasm
with the generated TypeScript and Go descriptors.

## Render and extract a document

For parsing, extraction, and display plain text together, create a processor:

```ts
const processor = runtime.createProcessor(presets.traq.v1, {
  origin: 'https://q.example.test',
  whitespace: 'collapse'
})
const { document, extraction, plainText } =
  processor.process('**hello** :stamp:')
processor.dispose()
```

`process` and `processInline` parse once and run both consumers against the same
validated native document in one Wasm call. Go exposes the same path through
`NewProcessor`, `Process`, and `ProcessInline`. Independent parsers, extractors,
and plain-text renderers remain available for callers that only need one result.
The `whitespace` policy defaults to `collapse`; `preserve` keeps rendered spacing.

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
const prepared = view.prepare(document)
const rendered = prepared.standard()
const condensed = prepared.condensed()
const html = rendered.html
```

`messageRenderers` builds `standard` and `condensed` views. `prepare(document)`
validates and analyzes an owned snapshot once, then shares it between both views.
`view.render(document)` returns both results; individual
`view.standard.render(document)` and `view.condensed.render(document)` are also
available. Preparation also accepts an existing core `DocumentContext`.
Each result contains `rawText`, `html`, and `cards`; the extractor returns
source-preserving message text, references, attachment and citation IDs, and an
embedding plan. The two views apply presentation choices without rewriting the
parsed AST. Complete Rust, Go, and TypeScript programs are in
[examples](examples/README.md).

For direct HTML, `html(options)` returns a renderer. `htmlPreset(options)`
returns a preset for the core `renderer()` composition API. Both accept
third-party renderer plugins through `plugins`; `configurePlugins` can replace
built-in handlers by returning updated plugin values:

```ts
import { definitions } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import { PluginDeclaration } from '@traq-flavored-markdown/core/definitions'
import { RenderPlugin } from '@traq-flavored-markdown/core/renderer'
import { html } from '@traq-flavored-markdown/sdk/renderer'

const annotation = new RenderPlugin(new PluginDeclaration('app')).on(
  'app::Annotation',
  (_node, context) => context.renderChildren()
)
const view = html({
  plugins: [annotation],
  configurePlugins(plugins) {
    return {
      ...plugins,
      common: plugins.common.replace(
        definitions.Strong,
        (_node, context) => '<b>' + context.renderChildren() + '</b>'
      )
    }
  }
})
const rendered = view.render(document)
```

The `renderer` entrypoint includes the default highlighter and KaTeX adapters.
Import the same composition functions from
`@traq-flavored-markdown/sdk/renderer/composition` to supply `code.highlight`
and `math.render` without importing either default dependency. Without those
adapters, composition emits escaped code and math content.

`RenderPlugin.on()` and `RenderPlugin.replace()` return new values. Keep the returned
plugin when composing a preset; existing plugins and presets are unchanged.

Built-in plugin groups are `common`, `extensions`, and `traq`. Generated node
definitions carry the node kind, payload validator, and child-structure contract,
so handlers infer their data types and invalid known nodes fail before rendering.
Custom nodes nested inside a known paragraph must use a definition with
`role: 'inline'`; see the [core API guide](../core/README.md) for `defineNode`.
Unknown roots and children of unconstrained parents use the escaped-source
fallback unless an application plugin handles them.

Display options are grouped by responsibility:

| Option                                                                 | Purpose                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------ |
| `links.validate`, `links.attributes`                                   | Destination policy and anchor attributes               |
| `images.validate`                                                      | Markdown image destination policy                      |
| `code.highlight`                                                       | Optional trusted code HTML adapter                     |
| `math.render`                                                          | Optional trusted math HTML adapter                     |
| `references.resolve`                                                   | Application reference labels, routes, and highlighting |
| `stamps.resolve`, `stamps.validateUrl`                                 | Stamp lookup and resolved image policy                 |
| `presentation.breaks`, `presentation.rawHtml`, `presentation.xhtmlOut` | Line breaks, raw HTML, and void-tag style              |

For example, `references.resolve(reference)` returns
`{ href, label, highlight }`, while `stamps.resolve(stamp)` returns
`{ url, title }`. Both may return `undefined` when unresolved. The renderer does
not know application stores or API endpoint layouts. Custom HTML adapters are
trusted code; escape document values before including them in generated HTML.

Direct rendering also supports repeated views with
`const session = html().createSession(document)`. Call `session.render(plan)`
with `roots`, `omittedNodes`, `childText`, or `rootSeparator` to change presentation
without editing the source AST. A plan may reference original or snapshot nodes
from that document; foreign nodes are rejected before handlers run.

TypeScript runtime failures are `MarkdownError` values with `code`, `operation`,
and optional `resource`, `path`, `offset`, `span`, `phase`, `rule`, and
`payloadType`. Invalid requests and native
domain errors leave an instance reusable. A trap or malformed Wasm response
closes the instance; later calls report `disposed`. `contract_mismatch` identifies
an artifact whose semantic contract differs from the generated SDK. The original
wire details are also retained in `cause`.

`runtime.createPlainTextRenderer()` exposes native display plain text, independently of
host HTML. `createExtractor()` and `createPlainTextRenderer()` accept omitted options;
their `origin` defaults to an empty string. Card presentation uses the
`ResourceCard` type, `resourceCardFromUrl()`, and `endsWithResourceCard()` from
the renderer entrypoint. Reference embedding is a separate source-editing API.

The stylesheet shares stamp sizes through `--tfm-stamp-normal-size`,
`--tfm-stamp-small-size`, `--tfm-stamp-large-size`, and
`--tfm-stamp-ex-large-size`. Compact message views use the normal size for large
stamps and their effects. Animation keyframes use the `tfm-stamp-` prefix.

## Grammar versions

Grammar versions identify the rules used to write a message. Store that value
with the source and create a parser for the stored version when reading it back.
Unknown versions fail rather than silently selecting a newer grammar.
In TypeScript, check a stored string with `isPreset(version)` before passing it
to `createParser`; the guard narrows it to the generated `Preset` type.

`presets.traq.v1` and `PresetTraqV1` are generated from the Rust preset catalog.
Custom grammars are composed in Rust and published through that catalog; the
TypeScript and Go APIs intentionally do not mirror the Rust grammar builder.
The v1 grammar is currently unreleased; its APIs and behavior can still change
after explicit review. Released presets preserve their interpretation of stored
content, with behavior changes assigned a new version.
