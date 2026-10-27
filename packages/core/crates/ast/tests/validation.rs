use markdown_ast::{
    DocumentView, MutableDocument, Node, NodeData, NodeRole, Span, ValidationErrorKind as Error,
    ValidationLimits,
};

#[derive(Clone, Debug, PartialEq)]
struct Data(bool);

impl NodeData for Data {
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
    fn validate_payload(&self, _: &[Node]) -> Result<(), markdown_ast::PayloadError> {
        let valid = self.0;
        if valid {
            Ok(())
        } else {
            Err(markdown_ast::PayloadError::new("custom payload invariant"))
        }
    }
}
fn leaf(start: usize, end: usize) -> Node {
    Node::leaf(Span { start, end }, Data(true))
}

#[test]
fn whole_document_validation_counts_descendants_and_observes_edits() {
    let mut doc = MutableDocument {
        source: "猫x".into(),
        children: vec![Node::new(
            Span { start: 0, end: 4 },
            Data(true),
            vec![leaf(0, 3), leaf(3, 4)],
        )],
    };

    let limits = ValidationLimits {
        source_bytes: 4,
        payload_bytes: 0,
        nodes: 3,
        depth: 2,
    };

    assert_eq!(
        doc.validate(limits)
            .map(|view| view.node_count())
            .map_err(|error| error.kind),
        Ok(3)
    );

    for (limits, error) in [
        (
            ValidationLimits {
                source_bytes: 3,
                ..limits
            },
            Error::SourceBytes,
        ),
        (ValidationLimits { nodes: 2, ..limits }, Error::Nodes),
        (ValidationLimits { depth: 1, ..limits }, Error::Depth),
    ] {
        assert_eq!(
            doc.validate(limits)
                .map(|view| view.node_count())
                .map_err(|error| error.kind),
            Err(error)
        );
    }

    doc.children[0].children[1].payload_mut::<Data>().unwrap().0 = false;
    assert_eq!(
        doc.validate(limits)
            .map(|view| view.node_count())
            .map_err(|error| error.kind),
        Err(Error::InvalidNode)
    );
    doc.children[0].children[1].payload_mut::<Data>().unwrap().0 = true;

    for (start, end) in [(1, 3), (3, 2), (0, 5), (0, usize::MAX)] {
        doc.children[0].children[1].span = Span { start, end };
        assert_eq!(
            doc.validate(limits)
                .map(|view| view.node_count())
                .map_err(|error| error.kind),
            Err(Error::InvalidSpan)
        );
    }

    doc.children[0].span = Span { start: 0, end: 3 };
    doc.children[0].children[1] = leaf(3, 4);

    assert_eq!(
        doc.validate(limits)
            .map(|view| view.node_count())
            .map_err(|error| error.kind),
        Err(Error::InvalidSpan)
    );
}

#[test]
fn empty_trees_allow_zero_limits_and_deep_trees_do_not_recurse() {
    let limits = ValidationLimits {
        source_bytes: 0,
        payload_bytes: 0,
        nodes: 0,
        depth: 0,
    };

    let mut doc = MutableDocument {
        source: String::new(),
        children: vec![],
    };

    assert_eq!(
        doc.validate(limits)
            .map(|view| view.node_count())
            .map_err(|error| error.kind),
        Ok(0)
    );
    doc.children.push(leaf(0, 0));

    assert_eq!(
        doc.validate(limits)
            .map(|view| view.node_count())
            .map_err(|error| error.kind),
        Err(Error::Nodes)
    );

    assert_eq!(
        doc.validate(ValidationLimits { nodes: 1, ..limits })
            .map(|view| view.node_count())
            .map_err(|error| error.kind),
        Err(Error::Depth)
    );

    for _ in 1..128 {
        doc.children = vec![Node::new(
            Span { start: 0, end: 0 },
            Data(true),
            doc.children,
        )];
    }

    assert_eq!(
        doc.validate(ValidationLimits::default())
            .map_err(|error| error.kind),
        Err(Error::Depth)
    );

    assert_eq!(
        doc.validate(ValidationLimits {
            depth: 128,
            nodes: 128,
            source_bytes: 0,
            payload_bytes: 0,
        })
        .map(|view| view.node_count()),
        Ok(128)
    );
}

#[test]
fn siblings_must_follow_source_order_without_overlapping() {
    let mut doc = MutableDocument {
        source: "abcdef".into(),
        children: vec![leaf(0, 2), leaf(2, 4), leaf(4, 6)],
    };
    let limits = ValidationLimits::default();
    assert_eq!(
        doc.validate(limits)
            .map(|view| view.node_count())
            .map_err(|error| error.kind),
        Ok(3)
    );

    doc.children[1].span = Span { start: 1, end: 4 };
    assert_eq!(
        doc.validate(limits)
            .map(|view| view.node_count())
            .map_err(|error| error.kind),
        Err(Error::InvalidSpan)
    );

    doc.children[1].span = Span { start: 5, end: 6 };
    assert_eq!(
        doc.validate(limits)
            .map(|view| view.node_count())
            .map_err(|error| error.kind),
        Err(Error::InvalidSpan)
    );

    doc.children = vec![Node::new(
        Span { start: 0, end: 6 },
        Data(true),
        vec![leaf(1, 3), leaf(2, 4)],
    )];
    assert_eq!(
        doc.validate(limits)
            .map(|view| view.node_count())
            .map_err(|error| error.kind),
        Err(Error::InvalidSpan)
    );
}

#[test]
fn validated_borrow_can_use_the_producers_custom_limits() {
    let doc = MutableDocument {
        source: "x".repeat(ValidationLimits::default().source_bytes + 1),
        children: vec![],
    };
    let limits = ValidationLimits {
        source_bytes: doc.source.len(),
        ..ValidationLimits::default()
    };

    assert!(matches!(
        DocumentView::new(&doc).map_err(|error| error.kind),
        Err(Error::SourceBytes)
    ));
    assert_eq!(
        DocumentView::with_limits(&doc, limits).unwrap().document(),
        &doc
    );
    assert!(matches!(
        DocumentView::with_limits(
            &doc,
            ValidationLimits {
                source_bytes: doc.source.len() - 1,
                ..limits
            }
        )
        .map_err(|error| error.kind),
        Err(Error::SourceBytes)
    ));
}

#[derive(Clone, Debug, PartialEq)]
struct Owned(String);
impl NodeData for Owned {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure {
            role: NodeRole::Inline,
            children: markdown_ast::ChildStructure::Any,
        };
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        self.0.len()
    }
}

#[test]
fn payload_limit_counts_native_node_data_before_consumption() {
    let doc = MutableDocument {
        source: String::new(),
        children: vec![
            Node::leaf(Span { start: 0, end: 0 }, Owned("abc".into())),
            Node::leaf(Span { start: 0, end: 0 }, Owned("def".into())),
        ],
    };
    let limits = ValidationLimits {
        payload_bytes: 5,
        ..ValidationLimits::default()
    };
    assert_eq!(
        doc.validate(limits)
            .map(|view| view.node_count())
            .map_err(|error| error.kind),
        Err(Error::PayloadBytes)
    );
    assert_eq!(
        doc.validate(ValidationLimits {
            payload_bytes: 6,
            ..limits
        })
        .map(|view| view.node_count()),
        Ok(2)
    );

    let huge = MutableDocument {
        source: String::new(),
        children: vec![Node::leaf(
            Span { start: 0, end: 0 },
            Owned("x".repeat(ValidationLimits::default().payload_bytes + 1)),
        )],
    };
    assert!(matches!(
        DocumentView::new(&huge).map_err(|error| error.kind),
        Err(Error::PayloadBytes)
    ));
}

#[test]
fn diagnostics_and_scoped_walk_share_tree_coordinates() {
    let mut document = MutableDocument {
        source: "abcd".into(),
        children: vec![
            Node::new(
                Span { start: 0, end: 3 },
                Data(true),
                vec![leaf(0, 1), leaf(1, 3)],
            ),
            leaf(3, 4),
        ],
    };
    let validated = DocumentView::new(&document).unwrap();
    assert_eq!(
        validated
            .walk()
            .map(|visit| (visit.index, visit.depth, visit.parent.is_some()))
            .collect::<Vec<_>>(),
        [(0, 1, false), (0, 2, true), (1, 2, true), (1, 1, false)]
    );
    let mut seen = vec![];
    validated
        .try_visit(0, |visit, inherited| {
            seen.push((visit.node.span.start, *inherited));
            Ok::<_, ()>(*inherited + 1)
        })
        .unwrap();
    assert_eq!(seen, [(0, 0), (0, 1), (1, 1), (3, 0)]);

    document.children[0].children[1]
        .payload_mut::<Data>()
        .unwrap()
        .0 = false;
    let error = DocumentView::new(&document).unwrap_err();
    assert_eq!(error.kind, Error::InvalidNode);
    assert_eq!(error.path, [0, 1]);
    assert_eq!(error.span, Some(Span { start: 1, end: 3 }));
    assert_eq!(error.payload_type, Some(std::any::type_name::<Data>()));
    assert_eq!(error.code(), "invalid_node");
}

#[test]
fn checked_owner_reuses_validation_and_editing_discards_the_proof() {
    use markdown_ast::DocumentInput;
    use std::sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    };
    #[derive(Debug, Clone)]
    struct Counted(Arc<AtomicUsize>);
    impl PartialEq for Counted {
        fn eq(&self, other: &Self) -> bool {
            Arc::ptr_eq(&self.0, &other.0)
        }
    }
    impl NodeData for Counted {
        fn structure() -> &'static markdown_ast::NodeStructure {
            static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure::opaque();
            &STRUCTURE
        }
        fn payload_bytes(&self) -> usize {
            0
        }
        fn validate_payload(&self, _: &[Node]) -> Result<(), markdown_ast::PayloadError> {
            self.0.fetch_add(1, Ordering::Relaxed);
            Ok(())
        }
    }
    let calls = Arc::new(AtomicUsize::new(0));
    let document = MutableDocument {
        source: "x".into(),
        children: vec![Node::leaf(
            Span { start: 0, end: 1 },
            Counted(calls.clone()),
        )],
    }
    .finish()
    .unwrap();
    for _ in 0..3 {
        (&document)
            .into_view()
            .unwrap()
            .check_limits(ValidationLimits::default())
            .unwrap();
    }
    assert_eq!(calls.load(Ordering::Relaxed), 1);
    let mut draft = document.into_mutable();
    draft.children[0].span.end = 2;
    assert_eq!(draft.finish().unwrap_err().kind, Error::InvalidSpan);
    assert_eq!(calls.load(Ordering::Relaxed), 1);
}
