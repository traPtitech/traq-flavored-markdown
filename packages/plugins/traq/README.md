# traQ plugin

This package provides the traP-specific Markdown extensions used by traQ. The
SDK chooses their grammar order and ships the resulting presets, bindings, and
application policies.

| Crate                      | Purpose                                                 |
| -------------------------- | ------------------------------------------------------- |
| `markdown-trap-contracts`  | Nodes for stamps, references, spoilers, and blank lines |
| `markdown-trap-syntax`     | traP syntax                                             |
| `markdown-trap-text`       | Plain-text rendering for traP nodes                     |
| `markdown-trap-extraction` | Reference extraction                                    |

Add the individual rule plugins to an application's `GrammarBuilder` or
`RenderPresetBuilder`. The caller selects their order and decides attachment and citation URL
display and how processing results are combined.

## Boundaries

The TypeScript package depends only on core. It
does not depend on SDK composition or distribution code.

The TypeScript package exports generated node types and HTML renderers. The Go
module is `github.com/traPtitech/traq-flavored-markdown/packages/plugins/traq/go`;
its payloads and node factories are generated from these Rust contracts. The
shared AST and Wasm runtime remain in the core Go module.

Import `@traq-flavored-markdown/traq-plugin/index.css` for standalone spoilers,
references, stamps, and animation styles. CSS custom properties control colors
and stamp sizes. `/nodes` exports `schema`; pass it to
`createRenderer(preset, { schema })` when rendering raw documents.

The HTML plugin accepts `resolveReference(reference)` and
`resolveStamp(namedStamp)` adapters. A reference resolver returns optional
`href`, `label`, and `highlight`; a stamp resolver returns `url` and optional
`title`. Applications own user/group stores, routes, and stamp API paths.
Unresolved stamps preserve their escaped original notation. URL policies are
applied after resolution, independently for links and stamp images.

`spacing` preserves additional source blank lines in their original containers.
An empty quote needs no synthetic node; the SDK display profile controls its
visibility. Stamps store semantic colors (numeric RGB or canonical HSL) and keep
their literal source separately.

The SDK processing crate owns the traQ composition and runnable native examples.

Rust crate identifiers retain the organization name `markdown-trap-*`. Public
feature namespaces, generated package groups, and serialized node kinds use
`traq`, matching the application and this plugin directory.
