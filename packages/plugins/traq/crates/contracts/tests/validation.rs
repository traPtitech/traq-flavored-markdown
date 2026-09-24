use markdown_ast::{Node, Span};
use markdown_trap_contracts::{
    BlankLineData, EmbeddingData, EmbeddingKind, ReferenceData, ReferenceKind, SpoilerData,
};

fn span() -> Span {
    Span { start: 0, end: 0 }
}

#[test]
fn references_embeddings_and_blank_lines_are_leaves() {
    let child = Node::leaf(span(), BlankLineData {});
    assert!(
        !Node::new(
            span(),
            ReferenceData {
                target: ReferenceKind::User,
                id: "id".into(),
                label: "label".into(),
            },
            vec![child.clone()],
        )
        .validate()
    );
    assert!(
        !Node::new(
            span(),
            EmbeddingData {
                target: EmbeddingKind::File,
                id: "id".into(),
                label: "label".into(),
                literal: "{}".into(),
            },
            vec![child.clone()],
        )
        .validate()
    );
    assert!(!Node::new(span(), BlankLineData {}, vec![child.clone()]).validate());
    assert!(!Node::new(span(), SpoilerData {}, vec![child]).validate());
}
