use markdown_ast::{Document, Node, NodeData, Span, ValidationError as Error, ValidationLimits};

#[derive(Clone, Debug, PartialEq)]
struct Data(bool);

impl NodeData for Data {
    fn validate(&self, _: &[Node]) -> bool {
        self.0
    }
}
fn leaf(start: usize, end: usize) -> Node {
    Node::leaf(Span { start, end }, Data(true))
}

#[test]
fn whole_document_validation_counts_descendants_and_observes_edits() {
    let mut doc = Document {
        source: "猫x".into(),
        children: vec![Node::new(
            Span { start: 0, end: 4 },
            Data(true),
            vec![leaf(0, 3), leaf(3, 4)],
        )],
    };

    let limits = ValidationLimits {
        source_bytes: 4,
        nodes: 3,
        depth: 2,
    };

    assert_eq!(doc.validate(limits), Ok(3));

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
        assert_eq!(doc.validate(limits), Err(error));
    }

    doc.children[0].children[1].get_mut::<Data>().unwrap().0 = false;
    assert_eq!(doc.validate(limits), Err(Error::InvalidNode));
    doc.children[0].children[1].get_mut::<Data>().unwrap().0 = true;

    for (start, end) in [(1, 3), (3, 2), (0, 5), (0, usize::MAX)] {
        doc.children[0].children[1].span = Span { start, end };
        assert_eq!(doc.validate(limits), Err(Error::InvalidSpan));
    }

    doc.children[0].span = Span { start: 0, end: 3 };
    doc.children[0].children[1] = leaf(3, 4);

    assert_eq!(doc.validate(limits), Err(Error::InvalidSpan));
}

#[test]
fn empty_trees_allow_zero_limits_and_deep_trees_do_not_recurse() {
    let limits = ValidationLimits {
        source_bytes: 0,
        nodes: 0,
        depth: 0,
    };

    let mut doc = Document {
        source: String::new(),
        children: vec![],
    };

    assert_eq!(doc.validate(limits), Ok(0));
    doc.children.push(leaf(0, 0));

    assert_eq!(doc.validate(limits), Err(Error::Nodes));

    assert_eq!(
        doc.validate(ValidationLimits { nodes: 1, ..limits }),
        Err(Error::Depth)
    );

    for _ in 1..128 {
        doc.children = vec![Node::new(
            Span { start: 0, end: 0 },
            Data(true),
            doc.children,
        )];
    }

    assert_eq!(doc.validate(ValidationLimits::default()), Err(Error::Depth));

    assert_eq!(
        doc.validate(ValidationLimits {
            depth: 128,
            nodes: 128,
            source_bytes: 0
        }),
        Ok(128)
    );
}
