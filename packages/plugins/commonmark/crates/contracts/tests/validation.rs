use markdown_ast::{
    Document, Node, NodeData, NodeRole, Span, ValidationErrorKind, ValidationLimits,
};
use markdown_commonmark_contracts::{
    Blockquote, Heading, Link, LinkForm, List, ListItem, ListKind, OrderedDelimiter, Paragraph,
    Text,
};

#[derive(Clone, Debug, PartialEq)]
struct ExternalInline;
impl NodeData for ExternalInline {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure {
            role: NodeRole::Inline,
            children: markdown_ast::ChildStructure::Any,
        };
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}

#[derive(Clone, Debug, PartialEq)]
struct ExternalBlock;
impl NodeData for ExternalBlock {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure {
            role: NodeRole::Block,
            children: markdown_ast::ChildStructure::Any,
        };
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}

fn span() -> Span {
    Span { start: 0, end: 0 }
}

fn paragraph() -> Node {
    Node::leaf(span(), Paragraph {})
}

#[test]
fn lists_store_one_semantic_kind_and_validate_item_shape() {
    let item = || Node::new(span(), ListItem {}, vec![paragraph()]);
    let list = |start, children| Document {
        source: String::new(),
        children: vec![Node::new(
            span(),
            List {
                kind: ListKind::Ordered {
                    start,
                    delimiter: OrderedDelimiter::Period,
                },
                tight: true,
            },
            children,
        )],
    };
    assert!(
        list(3, vec![item(), item()])
            .validate(ValidationLimits::default())
            .is_ok()
    );
    assert!(
        list(999_999_999, vec![item()])
            .validate(ValidationLimits::default())
            .is_ok()
    );
    for document in [
        list(3, vec![]),
        list(3, vec![item(), paragraph()]),
        list(1_000_000_000, vec![item()]),
    ] {
        assert_eq!(
            document
                .validate(ValidationLimits::default())
                .map_err(|error| error.kind),
            Err(ValidationErrorKind::InvalidNode)
        );
    }
    assert!(
        Node::new(
            span(),
            ListItem {},
            vec![Node::leaf(span(), Text { value: "x".into() })]
        )
        .validate()
        .is_err()
    );
}

#[test]
fn known_block_nodes_cannot_be_children_of_inline_containers() {
    assert!(
        Node::new(span(), Paragraph {}, vec![paragraph()])
            .validate()
            .is_err()
    );
    assert!(
        Node::new(span(), Heading { level: 1 }, vec![paragraph()],)
            .validate()
            .is_err()
    );
    assert!(
        Node::new(
            span(),
            Link {
                destination: "/".into(),
                title: None,
                form: LinkForm::Explicit,
            },
            vec![paragraph()],
        )
        .validate()
        .is_err()
    );
}

#[test]
fn parent_contracts_use_external_plugin_roles() {
    assert!(
        Node::new(
            span(),
            Paragraph {},
            vec![Node::leaf(span(), ExternalInline)]
        )
        .validate()
        .is_ok()
    );
    assert!(
        Node::new(
            span(),
            Paragraph {},
            vec![Node::leaf(span(), ExternalBlock)]
        )
        .validate()
        .is_err()
    );
    assert!(
        Node::new(
            span(),
            Blockquote {},
            vec![Node::leaf(span(), ExternalBlock)]
        )
        .validate()
        .is_ok()
    );
    assert!(
        Node::new(
            span(),
            Blockquote {},
            vec![Node::leaf(span(), ExternalInline)]
        )
        .validate()
        .is_err()
    );
    assert!(
        Node::new(span(), ListItem {}, vec![Node::leaf(span(), ExternalBlock)])
            .validate()
            .is_ok()
    );
    assert!(
        Node::new(
            span(),
            ListItem {},
            vec![Node::leaf(span(), ExternalInline)]
        )
        .validate()
        .is_err()
    );
}
