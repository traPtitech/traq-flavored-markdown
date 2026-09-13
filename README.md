# traQ Flavored Markdown Engine

Markdown parsing, rendering and extraction for traQ, implemented in Rust with
TypeScript and Go bindings. The repository groups code by responsibility, then
by language within each package.

| Directory                                                            | Responsibility                                                   | npm package                               |
| -------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------- |
| [packages/core](packages/core/README.md)                             | Grammar-independent AST, parser, renderer, extractor and codec   | `@traq-markdown-engine/core`              |
| [packages/plugins/commonmark](packages/plugins/commonmark/README.md) | CommonMark and reusable syntax/rendering extensions              | `@traq-markdown-engine/commonmark-plugin` |
| [packages/plugins/traq](packages/plugins/traq/README.md)             | traP references, stamps, spoilers and their rendering/extraction | `@traq-markdown-engine/traq-plugin`       |
| [packages/sdk](packages/sdk/README.md)                               | traQ presets, presentation, Wasm and SDK distribution            | `@traq-markdown-engine/sdk`               |

## Install from npm

Use Node 24 with npm 11.17.0. Most applications only need the SDK:

```sh
npm install @traq-markdown-engine/sdk
```

npm installs the SDK's peer dependencies, so that command includes the core and
plugin packages once they are available on the public registry. Install a lower
layer directly only when composing a custom integration:

```sh
npm install @traq-markdown-engine/core
npm install @traq-markdown-engine/commonmark-plugin
npm install @traq-markdown-engine/traq-plugin
```

Plugins are composable syntax and AST processing components. Core has no dependency
on a concrete plugin; the SDK selects and combines plugins for traQ. Each package keeps its
Rust crates, TypeScript implementation and Go module together. The npm names are
independent of directory names; Go module paths follow their directories.
They can be installed and composed independently, but release with one shared version.

Repository tooling lives in [scripts](scripts), with SDK-specific generation and
packaging in [packages/sdk/scripts](packages/sdk/scripts). The standalone
[corpus tool](tools/corpus/README.md) owns message comparison and report viewing.
Shared specification data lives in [tests/fixtures](tests/fixtures/README.md).

## Development

Use Node 24 with npm 11.17.0, Bun 1.3.14+, Go 1.26+, and rustup. The root
`rust-toolchain.toml` pins Rust and the Wasm target. Windows also requires the
MSVC C++ build tools. Install the root tooling and workspace dependencies:

```sh
bun install
```

The root commands operate on all four packages:

```sh
bun run format        # apply Prettier, rustfmt, and gofmt
bun run format:check  # verify formatting without modifying files
bun run lint:check    # run ESLint without modifying files
bun run build         # generate all bindings, then build TypeScript, Wasm and CSS
bun run typecheck     # type-check every TypeScript package
bun run test          # run TypeScript, Rust, and Go tests
bun run check         # run the complete local CI suite
```

Rust crates share one root Cargo workspace and lockfile. Go modules are connected
by the root `go.work`. TypeScript packages share compiler options while keeping
their source and output paths local.

Run `bun run build` before individual Wasm or Go tests. `bun run check` also builds
the corpus viewer and verifies generated sources and packed consumers. Individual
package commands are available with `bun run --cwd packages/sdk test`, for example.
See [CONTRIBUTING](CONTRIBUTING.md) for the build pipeline, ownership, fixtures,
verification, and npm publishing process, and [traQ examples](packages/sdk/examples/README.md)
for API usage.

TypeScript, JavaScript, JSON, Markdown, YAML, and styles use the Prettier rules
from traQ S-UI. Rust and Go use their standard formatters, `cargo fmt` and
`gofmt`.
