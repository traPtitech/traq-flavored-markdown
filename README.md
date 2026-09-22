# traQ Flavored Markdown Engine

Markdown parsing, rendering and extraction for traQ, implemented in Rust with
TypeScript and Go bindings. The repository groups code by responsibility, then
by language within each package.

| Directory                                                            | Responsibility                                                   | npm package                                 |
| -------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------- |
| [packages/core](packages/core/README.md)                             | Grammar-independent AST, parser, renderer, extractor and codec   | `@traq-flavored-markdown/core`              |
| [packages/plugins/commonmark](packages/plugins/commonmark/README.md) | CommonMark and reusable syntax/rendering extensions              | `@traq-flavored-markdown/commonmark-plugin` |
| [packages/plugins/traq](packages/plugins/traq/README.md)             | traP references, stamps, spoilers and their rendering/extraction | `@traq-flavored-markdown/traq-plugin`       |
| [packages/sdk](packages/sdk/README.md)                               | traQ presets, presentation, Wasm and SDK distribution            | `@traq-flavored-markdown/sdk`               |

## Install from npm

Use Node 24 with npm 11.17.0. Most applications only need the SDK:

```sh
npm install @traq-flavored-markdown/sdk
```

npm installs the SDK's peer dependencies, so that command includes the core and
plugin packages once they are available on the public registry. Install a lower
layer directly only when composing a custom integration:

```sh
npm install @traq-flavored-markdown/core
npm install @traq-flavored-markdown/commonmark-plugin
npm install @traq-flavored-markdown/traq-plugin
```

Plugins are composable syntax and AST processing components. Core has no dependency
on a concrete plugin; the SDK selects and combines plugins for traQ. Each package keeps its
Rust crates, TypeScript implementation and Go module together. The npm names are
independent of directory names; Go module paths follow their directories.
They can be installed and composed independently, but release with one shared version.

## Development

Install workspace dependencies, then run the full local check:

```sh
bun install --frozen-lockfile
bun run check
```

See [CONTRIBUTING](CONTRIBUTING.md) for the development, verification, and
release guides. The SDK package contains the public API and runnable examples.
