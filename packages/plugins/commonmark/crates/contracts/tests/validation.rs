use markdown_ast::{Document, Node, NodeData, NodeRole, Span, ValidationError, ValidationLimits};
use markdown_commonmark_contracts::{
    Blockquote, Heading, Link, LinkForm, List, ListItem, Paragraph, Text,
};

#[derive(Clone, Debug, PartialEq)]
struct ExternalInline;
impl NodeData for ExternalInline {
    fn role(&self) -> NodeRole {
        NodeRole::Inline
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}

#[derive(Clone, Debug, PartialEq)]
struct ExternalBlock;
impl NodeData for ExternalBlock {
    fn role(&self) -> NodeRole {
        NodeRole::Block
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
fn list_children_and_markers_follow_the_list_contract() {
    let item = |marker: &str| {
        Node::new(
            span(),
            ListItem {
                marker: marker.into(),
            },
            vec![paragraph()],
        )
    };
    let list = |children| Document {
        source: String::new(),
        children: vec![Node::new(
            span(),
            List {
                ordered: true,
                start: 3,
                tight: true,
            },
            children,
        )],
    };

    assert!(
        list(vec![item("3."), item("4.")])
            .validate(ValidationLimits::default())
            .is_ok()
    );
    for children in [
        vec![],
        vec![item("2.")],
        vec![item("3."), item("4)")],
        vec![item("3."), paragraph()],
    ] {
        assert_eq!(
            list(children).validate(ValidationLimits::default()),
            Err(ValidationError::InvalidNode)
        );
    }

    assert!(!item("1234567890.").validate());
    assert!(
        !Node::new(
            span(),
            ListItem { marker: "-".into() },
            vec![Node::leaf(span(), Text { value: "x".into() })],
        )
        .validate()
    );
}

#[test]
fn known_block_nodes_cannot_be_children_of_inline_containers() {
    assert!(!Node::new(span(), Paragraph {}, vec![paragraph()]).validate());
    assert!(!Node::new(span(), Heading { level: 1 }, vec![paragraph()],).validate());
    assert!(
        !Node::new(
            span(),
            Link {
                destination: "/".into(),
                title: None,
                form: LinkForm::Explicit,
            },
            vec![paragraph()],
        )
        .validate()
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
    );
    assert!(
        !Node::new(
            span(),
            Paragraph {},
            vec![Node::leaf(span(), ExternalBlock)]
        )
        .validate()
    );
    assert!(
        Node::new(
            span(),
            Blockquote {},
            vec![Node::leaf(span(), ExternalBlock)]
        )
        .validate()
    );
    assert!(
        !Node::new(
            span(),
            Blockquote {},
            vec![Node::leaf(span(), ExternalInline)]
        )
        .validate()
    );
    assert!(
        Node::new(
            span(),
            ListItem { marker: "-".into() },
            vec![Node::leaf(span(), ExternalBlock)]
        )
        .validate()
    );
    assert!(
        !Node::new(
            span(),
            ListItem { marker: "-".into() },
            vec![Node::leaf(span(), ExternalInline)]
        )
        .validate()
    );
}
