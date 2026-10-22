use markdown_ast::{Document, Node, NodeData, NodeKind, NodeRole, Span};

#[derive(Debug, Clone, PartialEq)]
struct Score(f64);

impl NodeData for Score {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure {
            role: NodeRole::Opaque,
            children: markdown_ast::ChildStructure::Any,
        };
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate_payload(&self, children: &[Node]) -> Result<(), markdown_ast::PayloadError> {
        let valid = children.is_empty();
        if valid {
            Ok(())
        } else {
            Err(markdown_ast::PayloadError::new("custom payload invariant"))
        }
    }
}
#[derive(Debug, Clone, PartialEq)]
struct Container;

impl NodeData for Container {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure {
            role: NodeRole::Opaque,
            children: markdown_ast::ChildStructure::Any,
        };
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate_payload(&self, children: &[Node]) -> Result<(), markdown_ast::PayloadError> {
        let valid = children.iter().all(|child| child.get::<Score>().is_some());
        if valid {
            Ok(())
        } else {
            Err(markdown_ast::PayloadError::new("custom payload invariant"))
        }
    }
}

#[test]
fn native_borrow_clone_validation_and_partial_equality() {
    fn send_sync<T: Send + Sync>() {}
    send_sync::<Document>();

    let span = Span { start: 0, end: 1 };
    let original = Node::new(span, Container, vec![Node::leaf(span, Score(1.5))]);

    assert!(original.validate().is_ok());

    let mut copy = original.clone();
    copy.children[0].get_mut::<Score>().unwrap().0 = 2.5;

    assert_ne!(original, copy);
    assert_eq!(original.children[0].get::<Score>(), Some(&Score(1.5)));
    assert!(original.get::<Score>().is_none());

    copy.children.push(Node::leaf(span, Container));
    assert!(copy.validate().is_err());

    let nan = Node::leaf(span, Score(f64::NAN));
    assert_ne!(nan, nan.clone());

    let boxed = NodeKind::new(Score(1.5));
    assert_eq!(Node::leaf(span, boxed), original.children[0]);
}

#[test]
fn custom_payload_validation_cannot_bypass_the_declared_structure() {
    #[derive(Debug, Clone, PartialEq)]
    struct Leaf;
    impl NodeData for Leaf {
        fn structure() -> &'static markdown_ast::NodeStructure {
            static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
                std::sync::LazyLock::new(|| markdown_ast::NodeStructure::leaf(NodeRole::Inline));
            &STRUCTURE
        }
        fn payload_bytes(&self) -> usize {
            0
        }
        fn validate_payload(&self, _: &[Node]) -> Result<(), markdown_ast::PayloadError> {
            Ok(())
        }
    }
    let span = Span { start: 0, end: 0 };
    let valid = Node::leaf(span, Leaf);
    assert_eq!(valid.role(), Leaf::structure().role);
    assert!(valid.validate().is_ok());
    let invalid = Node::new(span, Leaf, vec![valid]);
    assert_eq!(invalid.validate().unwrap_err().expected, "no children");
}
