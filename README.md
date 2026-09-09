# traq-markdown-engine

Monorepo for the traQ Markdown parser packages:

- `@traq-markdown-parser/core`
- `@traq-markdown-parser/commonmark`
- `@traq-markdown-parser/trap-extension`
- `@traq-markdown-parser/traq`

The packages retain their existing public npm names and Go module paths.

## Formatting

TypeScript, JavaScript, JSON, Markdown, and YAML are formatted with Prettier:

```sh
npm run format
```

The Prettier rules match the current traQ S-UI configuration. Rust and Go use
their standard formatters, `cargo fmt` and `gofmt`, respectively.
