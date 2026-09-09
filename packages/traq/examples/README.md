# Examples

Run `npm ci` and `npm run build` at the repository root first.

| Language | Source | Command |
| --- | --- | --- |
| Rust | [main.rs](rust/src/main.rs) | `npm run example:rust` |
| Go | [main.go](go/main.go) | `npm run example:go` |
| TypeScript | [main.mts](typescript/main.mts) | `npm run example:ts` |

`npm run examples` runs all three. Each example parses with traQ V1. The native Rust example also constructs an independent grammar without math; host bindings select Rust-exported presets. They print the AST and explicitly release host resources. Rust uses RAII for cleanup.

Rust uses the local `traq-markdown-grammar` grammar crate; extension implementations resolve from pinned Git dependencies. Go uses a local `replace` for this repository's module. TypeScript imports this package's public exports. No registry publication or application checkout is required.

The Go example accepts `-wasm /path/to/parser.wasm`. TypeScript uses `readFile` in Node.js; browser applications can pass `new Uint8Array(await response.arrayBuffer())` to `createRuntime(bytes)`, then use `runtime.createParser(presets.traq.v1)`.

HTML rendering examples live in [traq-markdown-it](https://github.com/traPtitech/traq-markdown-it). Native notification and extraction examples live in [this repository](../crates/processing/examples).

Each example passes a parsed Document directly to an Extractor. Rust and Go also render the AST with a PlainTextRenderer. Rust uses the local `traq-markdown-processing` crate; Go and TypeScript create their Extractor from the same Runtime as their Parser.
