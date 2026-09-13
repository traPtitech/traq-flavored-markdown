# SDK implementation notes

This guide documents the boundary between the native Rust implementation and
the TypeScript and Go SDKs. For everyday usage, start with the
[SDK README](../README.md).

## Ownership and generated contracts

Rust owns grammar composition, parsing, node contracts, and semantic
validation. `crates/grammar/src/bindings/presets.rs` defines the published
preset names, native grammars, and generated TypeScript/Go preset constants.
`crates/wasm/src/node_types.rs` registers the node contracts exposed by Wasm.

The core AST shape is `{ source, children }`; a node is
`{ kind, span, data, children? }`. `kind` is a key generated from the Rust
payload type, and `span` is a UTF-8 byte range in `source`. Consumers should use
the generated names and Go types instead of reproducing those contracts.

TypeScript and Go bindings are generated from Rust. The TypeScript payload guards
only verify a node kind and its payload: they do not validate arbitrary JSON, a
span, or descendants. Unsupported contract shapes or generated-name collisions
fail generation, rather than requiring hand-written host implementations.

The build ID detects mismatched Rust source, lockfile, manifest, or pinned
toolchain inputs. It normalizes line endings and paths, so it remains stable
across build environments. It is not a signature. `dist/contract.json` also
records the actual Wasm SHA-256 for diagnostics.

## TypeScript runtime

```ts
import { createRuntime, presets } from '@traq-markdown-engine/sdk'
import { names } from '@traq-markdown-engine/sdk/nodes'

const runtime = await createRuntime(wasmBytes)
try {
  const parser = runtime.createParser(presets.traq.v1)
  for (const node of parser.parseInline('[document](https://example.com)')
    .children) {
    if (node.kind === names.Link) console.log(node.data.destination)
  }
} finally {
  runtime.dispose()
}
```

`createRuntime` compiles the Wasm module once. `createParser` synchronously
creates an independent instance after checking its build ID; `parse` and
`parseInline` are synchronous. Dispose parsers individually or dispose the
runtime to release every parser and the compiled module. Both operations are
idempotent, and later use is rejected.

Input must be a string encodable as at most 64 KiB of UTF-8. Unpaired surrogates
are rejected. Parse errors retain structured details in `Error.cause`. Input and
native resource-limit errors do not invalidate a parser; after a Wasm trap or a
corrupted exchange, create a new parser.

## Go runtime

```go
import (
    "fmt"

    markdown "github.com/uni-kakurenbo/traq-markdown-engine/packages/sdk/go"
    commonmark "github.com/uni-kakurenbo/traq-markdown-engine/packages/plugins/commonmark/go"
)

runtime, err := markdown.NewRuntime(ctx, wasmBytes)
if err != nil { return err }
defer runtime.Close(ctx)

parser, err := runtime.NewParser(ctx, markdown.PresetTraQV1)
if err != nil { return err }
defer parser.Close(ctx)

document, err := parser.ParseInline(ctx, "[document](https://example.com)")
if err != nil { return err }
for _, node := range document.Children {
    if link, ok := node.Data.(*commonmark.Link); ok {
        fmt.Println(link.Destination)
    }
}
```

`Document` is the shared core AST, and extension modules own its generated
payload types. Parsed results do not reference Wasm memory and remain usable
after later parsing or disposal; use `json.Marshal` when JSON is needed.

A runtime owns a wazero environment and one compiled Wasm module. Each parser,
extractor, or plain-text renderer owns an independent instance and serializes
its calls. Use several instances for parallel work. Cancellation before or while
waiting for a call does not close an instance. Interrupting active Wasm execution
does close that instance, so create a replacement from the same runtime.
`Close` can interrupt active calls; closing a runtime also prevents new instances.

## Parsing, rendering, and extraction

Only a parser selects a grammar version. Renderers and extractors consume the
`Document` produced by that parser and never reparse its source. The native API
is `extraction::Extractor::extract(&Document)` and
`rendering::PlainTextRenderer::render(&Document)`.

Wasm provides equivalent configure and operation pairs for extractors and
renderers. Each operation accepts document JSON, validates it with the Rust
codec, then invokes the native consumer. It replies with `{ result: ... }` or
`{ error: string }`; error text has no stable machine-readable classification.

The extractor returns message text, references, attachments, citations, and an
embedding plan. The plain-text renderer returns notification text. TypeScript
HTML rendering uses the same `Document` directly on the host. `messageRenderers`
creates standard and condensed renderers from shared options; structure belongs
to node handlers, and core's fallback returns only escaped source text.

## Limits and persistence

Markdown input is limited to 64 KiB. The Rust transport accepts at most 1 MiB of
AST JSON and 32 MiB of Wasm memory; decoded documents retain parser limits on
source size, depth, and node count. These limits apply independently of Go
cancellation and disposal rules.

Store source text and its persistent grammar version, not a serialized AST.
Parse stored text again with its matching preset. The SDK intentionally provides
no compatibility layer for persisted ASTs.
