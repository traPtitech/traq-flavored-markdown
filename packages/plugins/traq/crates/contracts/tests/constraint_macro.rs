use markdown_ast::{Node, Span};
use markdown_definitions::node;

#[node(role = Inline)]
#[derive(Debug, Clone, PartialEq)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
struct Constrained {
    #[constraint(range(min = 1, max = 3))]
    count: u8,
    #[constraint(length(min = 1, max = 3))]
    values: Vec<u8>,
}

#[test]
fn native_constraints_enforce_inclusive_bounds() {
    for count in 0..=4 {
        for length in 0..=4 {
            let node = Node::leaf(
                Span { start: 0, end: 0 },
                Constrained {
                    count,
                    values: vec![0; length],
                },
            );

            assert_eq!(
                node.validate().is_ok(),
                (1..=3).contains(&count) && (1..=3).contains(&length)
            );
        }
    }
}
