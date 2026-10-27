use markdown_ast::{AnyPayload, MutableDocument, Node, NodeData, NodeRole, Span};

#[derive(Debug, Clone, PartialEq)]
struct Score(f64);

impl NodeData for Score {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure::opaque();
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
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure::opaque();
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate_payload(&self, children: &[Node]) -> Result<(), markdown_ast::PayloadError> {
        let valid = children
            .iter()
            .all(|child| child.payload::<Score>().is_some());
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
    send_sync::<MutableDocument>();

    let span = Span { start: 0, end: 1 };
    let original = Node::new(span, Container, vec![Node::leaf(span, Score(1.5))]);

    assert!(original.validate().is_ok());

    let mut copy = original.clone();
    copy.children[0].payload_mut::<Score>().unwrap().0 = 2.5;

    assert_ne!(original, copy);
    assert_eq!(original.children[0].payload::<Score>(), Some(&Score(1.5)));
    assert!(original.payload::<Score>().is_none());

    copy.children.push(Node::leaf(span, Container));
    assert!(copy.validate().is_err());

    let nan = Node::leaf(span, Score(f64::NAN));
    assert_ne!(nan, nan.clone());

    let boxed = AnyPayload::new(Score(1.5));
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

#[test]
fn child_arity_validation_rejects_mismatched_payload_types_without_panicking() {
    use markdown_ast::{ChildArity, ChildStructure, NodeStructure, PayloadType};

    let structure = NodeStructure {
        role: NodeRole::Block,
        children: ChildStructure::Sequence {
            prefix: vec![],
            rest: PayloadType::of::<Container>(),
            child_arity: Some(ChildArity::new::<Container>("columns", |_| 1)),
        },
    };
    let span = Span { start: 0, end: 0 };
    let child = Node::new(span, Container, vec![Node::leaf(span, Score(1.0))]);
    assert!(structure.validate(&Container, &[child]).is_ok());

    let error = structure.validate(&Score(1.0), &[]).unwrap_err();
    assert_eq!(error.expected, "payload matching the child arity accessor");
    assert_eq!(
        error.actual,
        Some(format!(
            "payload is not {}",
            std::any::type_name::<Container>()
        ))
    );
}

#[test]
fn generic_structures_borrow_const_metadata_for_each_payload_type() {
    use markdown_ast::{ChildStructure, NodeStructure, PayloadType};
    use std::{any::TypeId, borrow::Cow};

    fn structure<T: NodeData>() -> &'static NodeStructure {
        const {
            &NodeStructure {
                role: NodeRole::Block,
                children: ChildStructure::Types {
                    types: Cow::Borrowed(&[PayloadType::of::<T>()]),
                    nonempty: true,
                },
            }
        }
    }

    let ChildStructure::Types { types, nonempty } = &structure::<Score>().children else {
        panic!("expected a typed child structure");
    };
    assert!(matches!(types, Cow::Borrowed(_)));
    assert!(nonempty);
    assert_eq!(types[0].id(), TypeId::of::<Score>());
    assert_eq!(types[0].name(), std::any::type_name::<Score>());
    assert!(format!("{:?}", types[0]).contains(std::any::type_name::<Score>()));

    let span = Span { start: 0, end: 0 };
    let score = Node::leaf(span, Score(1.0));
    assert!(
        structure::<Score>()
            .validate(&(), std::slice::from_ref(&score))
            .is_ok()
    );
    assert!(structure::<Container>().validate(&(), &[score]).is_err());
}

#[test]
fn payload_validation_errors_propagate_through_standard_error_boundaries() {
    use markdown_ast::PayloadError;

    fn validate() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Node::new(
            Span { start: 0, end: 0 },
            Score(1.0),
            vec![Node::leaf(Span { start: 0, end: 0 }, Container)],
        )
        .validate()?;
        Ok(())
    }

    let error = validate().unwrap_err();
    assert_eq!(
        error.downcast_ref::<PayloadError>().unwrap().expected,
        "custom payload invariant"
    );
    assert_eq!(error.to_string(), "expected custom payload invariant");
    assert_eq!(
        PayloadError::new("one child")
            .actual("two children")
            .to_string(),
        "expected one child, got two children"
    );
}
