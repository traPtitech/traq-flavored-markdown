# markdown-definitions

Shared plugin declarations and node-type metadata for parser and renderer
implementations. This crate does not depend on parser, renderer, AST, or serde;
the derive dependency is compile-time only.

The `handlers` module supplies the registration snapshots shared by renderers
and extractors. It manages atomic add, replace, and remove operations plus
handler type and display-name collisions. Each consumer owns invocation and tree
traversal.

```rust
use markdown_definitions::{NodeType, Plugin};

#[derive(NodeType)]
struct Issue { number: u32 }

let generic = Plugin::group("Generic");
let github = generic.group("GitHub");
let links = github.new("Links");
assert_eq!(links.name(), "Links");
assert_eq!(links.namespace(), Some(&github));
assert_eq!(github.parent(), Some(&generic));
```

## Plugin declarations

`Plugin` and `PluginGroup` require a display name. Identity is instance-based:
two declarations with the same name are distinct. Parents are shared internally,
so child declarations retain their hierarchy after local parent variables leave
scope. Names are descriptive only; they do not form IDs or transport keys.

Builders call `validate_names(plugins)` to reject duplicated sibling names in a
shared declaration or ancestor group. Same names under different parents are
valid. A slash has no special hierarchy meaning. Builders remain responsible for
rule, handler-type, and implementation-instance collisions.

## `NodeType`

`#[derive(NodeType)]` produces transport metadata from a type's defining module
and name, including type and const arguments. It supports primitive types,
`String`, `Vec`, `Option`, `Box`, and arrays; generic arguments must also be
`NodeType`. Renaming the crate, type, or defining module changes the key.

The key is not a stable persistence or grammar-version ID. Codec registration
rejects key collisions, and matching keys alone do not guarantee compatible
payload semantics. Implement `NodeData` to use a type in a native AST; also
implement `NodeType` and serde traits to register it with a codec.
