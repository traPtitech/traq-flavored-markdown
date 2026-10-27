use markdown_ast::{Node, NodeData, Span};
use markdown_definitions::node;

#[node(role = Inline)]
#[derive(Debug, Clone, PartialEq)]
struct GenericLeaf<T, const N: usize> {
    value: [T; N],
}

#[node(role = Block, child_type = T, nonempty)]
#[derive(Debug, Clone, PartialEq)]
struct GenericContainer<T> {
    value: Option<T>,
}

#[node(role = Block, child_type = Self)]
#[derive(Debug, Clone, PartialEq)]
struct Recursive {}

#[node(role = Block, child_type = NamedRecursive::<T>)]
#[derive(Debug, Clone, PartialEq)]
struct NamedRecursive<T> {
    value: T,
}

fn leaf<const N: usize>() -> Node {
    Node::leaf(Span { start: 0, end: 0 }, GenericLeaf { value: [0u8; N] })
}

#[test]
fn generic_child_contracts_preserve_each_concrete_type_identity() {
    let container = |children| {
        Node::new(
            Span { start: 0, end: 0 },
            GenericContainer::<GenericLeaf<u8, 1>> { value: None },
            children,
        )
    };

    assert!(container(vec![leaf::<1>()]).validate().is_ok());
    assert!(container(vec![leaf::<2>()]).validate().is_err());
    assert!(container(vec![]).validate().is_err());

    let other = Node::new(
        Span { start: 0, end: 0 },
        GenericContainer::<GenericLeaf<u8, 2>> { value: None },
        vec![leaf::<2>()],
    );
    assert!(other.validate().is_ok());
}

#[test]
fn generic_payload_fields_are_accounted_for_and_leaf_contracts_are_enforced() {
    let payload = GenericLeaf {
        value: [String::from("hello"), String::from("世界")],
    };
    assert_eq!(payload.payload_bytes(), 11);

    let node = Node::new(Span { start: 0, end: 0 }, payload, vec![leaf::<1>()]);
    assert!(node.validate().is_err());
}

#[test]
fn recursive_child_contracts_do_not_require_cyclic_trait_bounds() {
    let span = Span { start: 0, end: 0 };
    let node = Node::new(span, Recursive {}, vec![Node::leaf(span, Recursive {})]);
    assert!(node.validate().is_ok());

    let node = Node::new(
        span,
        NamedRecursive { value: 0u8 },
        vec![Node::leaf(span, NamedRecursive { value: 1u8 })],
    );
    assert!(node.validate().is_ok());

    let wrong = Node::new(
        span,
        NamedRecursive { value: 0u8 },
        vec![Node::leaf(span, NamedRecursive { value: 1u16 })],
    );
    assert!(wrong.validate().is_err());
}
