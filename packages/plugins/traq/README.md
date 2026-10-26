# traQ plugin

This package provides the traQ-specific Markdown extensions used by traQ. The
SDK chooses their grammar order and ships the resulting presets, bindings, and
application policies.

| Crate                      | Purpose                                                 |
| -------------------------- | ------------------------------------------------------- |
| `markdown-traq-contracts`  | Nodes for stamps, references, spoilers, and blank lines |
| `markdown-traq-syntax`     | traQ syntax                                             |
| `markdown-traq-text`       | Plain-text rendering for traQ nodes                     |
| `markdown-traq-extraction` | Reference extraction                                    |

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

Spoilers render as `.spoiler` elements, concealed until the host adds the `shown`
attribute. Hosts own pointer and keyboard activation, focus, and matching
accessibility state for interactive spoilers. Reference classes use
`.message-user-link`, `.message-group-link`, or `.message-channel-link`; highlighted
users and groups add the corresponding `-highlight` class. Stamp `.emoji` elements
and ordered `.emoji-effect` wrappers share the `--tfm-stamp-*-size` properties.

The HTML plugin accepts `resolveReference(reference)` and
`resolveStamp(namedStamp)` adapters. A reference resolver returns optional
`href`, `label`, and `highlight`; a stamp resolver returns `url` and optional
`title`. Applications own user/group stores, routes, and stamp API paths.
Unresolved stamps preserve their escaped original notation. URL policies are
applied after resolution, independently for links and stamp images.

`spacing` preserves additional source blank lines in their original containers.
An empty quote needs no synthetic node; the SDK display profile controls its
visibility. Stamps store semantic colors (numeric RGB, RGBA, or canonical HSL) and keep
their literal source separately.

Hex color stamps accept exactly 3, 4, 6, or 8 hexadecimal digits after `0x`.
Three-digit RGB and four-digit RGBA forms duplicate each digit, so `:0xf00:`
is red (`#ff0000`) and `:0xf008:` is translucent red (`#ff000088`). Six-digit
RGB keeps the existing `hex_color` payload; four- and eight-digit RGBA use
`hex_rgba_color` with an unsigned 32-bit `rgba` value in `RRGGBBAA` order.
HTML uses lowercase six- or eight-digit colors and labels, preserving alpha
and leading zeros. Plain-text rendering retains the authored notation.
Effects and sizes apply to all color forms. Other lengths and invalid hex
digits remain ordinary stamp names, with no truncation or zero-padding guess.

The SDK processing crate owns the traQ composition and runnable native examples.
