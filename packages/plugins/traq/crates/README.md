# traP extension crates

| Directory                          | Package                    | Purpose                                                 |
| ---------------------------------- | -------------------------- | ------------------------------------------------------- |
| `contracts`                        | `markdown-trap-contracts`  | Nodes for references, stamps, spoilers, and blank lines |
| `syntax`                           | `markdown-trap-syntax`     | traP syntax and compatibility rules                     |
| [text](text/README.md)             | `markdown-trap-text`       | Plain-text rendering for traP nodes                     |
| [extraction](extraction/README.md) | `markdown-trap-extraction` | Reference extraction                                    |

Contracts are independent of parsing and rendering. Text rendering and
extraction do not depend on a parser. The SDK owns traQ grammar presets and its
plain-text and reference-processing presets.

These crates share a version within the workspace and are versioned independently
of the core, CommonMark, and SDK families.
