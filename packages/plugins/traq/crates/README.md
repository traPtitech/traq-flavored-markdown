# traQ extension crates

| Directory                          | Package                    | Purpose                                                 |
| ---------------------------------- | -------------------------- | ------------------------------------------------------- |
| `contracts`                        | `markdown-traq-contracts`  | Nodes for references, stamps, spoilers, and blank lines |
| `syntax`                           | `markdown-traq-syntax`     | traQ syntax and source-preserving blank lines           |
| [text](text/README.md)             | `markdown-traq-text`       | Plain-text rendering for traQ nodes                     |
| [extraction](extraction/README.md) | `markdown-traq-extraction` | Reference extraction                                    |

Contracts are independent of parsing and rendering. Text rendering and
extraction do not depend on a parser. The SDK owns traQ grammar presets and its
plain-text and reference-processing presets.

These crates share a version within the workspace and are versioned independently
of the core, CommonMark, and SDK families.
