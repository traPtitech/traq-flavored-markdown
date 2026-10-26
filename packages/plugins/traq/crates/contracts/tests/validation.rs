use markdown_ast::{Node, Span};
use markdown_traq_contracts::{
    BlankLine, Embedding, EmbeddingKind, Reference, ReferenceKind, Spoiler,
};

fn span() -> Span {
    Span { start: 0, end: 0 }
}

#[test]
fn references_embeddings_and_blank_lines_are_leaves() {
    let child = Node::leaf(span(), BlankLine {});
    assert!(
        Node::new(
            span(),
            Reference {
                target: ReferenceKind::User,
                id: "id".into(),
                label: "label".into(),
            },
            vec![child.clone()],
        )
        .validate()
        .is_err()
    );
    assert!(
        Node::new(
            span(),
            Embedding {
                target: EmbeddingKind::File,
                id: "id".into(),
                label: "label".into(),
                literal: "{}".into(),
            },
            vec![child.clone()],
        )
        .validate()
        .is_err()
    );
    assert!(
        Node::new(span(), BlankLine {}, vec![child.clone()])
            .validate()
            .is_err()
    );
    assert!(
        Node::new(span(), Spoiler {}, vec![child])
            .validate()
            .is_err()
    );
}
