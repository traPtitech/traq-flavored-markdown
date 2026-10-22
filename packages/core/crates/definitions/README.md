# markdown-definitions

Shared plugin declarations and node-type metadata for parser and renderer
implementations. This crate does not depend on parser, renderer, AST, or serde;
the derive dependency is compile-time only.

`#[node(role = Inline)]` derives a leaf node's structural contract, heap-byte
accounting, and payload validation. Use `children = Inline` for allowed child
roles, `child_type = Item, nonempty` for typed children, or `structure = function`
for an explicit Rust structural contract. `#[payload]` derives field accounting
and validation for nested structs and enums. Consumers of these attributes
depend on `markdown-ast`; the declarations crate retains no runtime AST dependency.

Field attributes `#[constraint(range(min = 1, max = 6))]` and
`#[constraint(length(max = 5))]` generate both native checks and Schemars metadata
under the consumer's `contracts` feature. Bounds use Rust expressions of the
field's type, including floating-point bounds for floating-point fields.
Nested strings, options, vectors, arrays, and boxes participate in heap accounting
and validation automatically. Custom payload field types implement
`markdown_ast::PayloadFields`; handwritten `NodeData` implementations remain
available for invariants outside these basic constraints.

The `handlers` module supplies the registration snapshots shared by renderers
and extractors. It manages atomic add, replace, and remove operations plus
handler type and display-name collisions. Each consumer owns invocation and tree
traversal.

```rust
use markdown_definitions::{NodeType, Plugin};

#[derive(NodeType)]
#[node_type(key = "example.issue")]
struct Issue { number: u32 }

let generic = Plugin::group("Generic");
let github = generic.group("GitHub");
let links = github.plugin("Links");
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

`#[derive(NodeType)]` requires an explicit `#[node_type(key = "vendor.node")]`.
For a plugin with several payloads, its contract catalog assigns the keys and
implements `NodeType` from one list. Generic type and const arguments are
included in a derived key; generic arguments must also be `NodeType`.

Wire keys stay stable across Rust module and type renames. Codec registration
rejects key collisions, while matching keys alone do not guarantee compatible
payload semantics. Implement `NodeData`, `NodeType`, and serde traits to use a
type in a native AST and register it with a codec.
