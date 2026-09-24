use markdown_ast::{Document, Node, Span, ValidationError, ValidationLimits};
use markdown_generic_contracts::{
    Alignment, BlockMathData, CellData, InlineMathData, RowData, TableData,
};

fn span() -> Span {
    Span { start: 0, end: 0 }
}

fn cell(alignment: Option<Alignment>) -> Node {
    Node::leaf(span(), CellData { alignment })
}

fn row(header: bool, cells: Vec<Node>) -> Node {
    Node::new(span(), RowData { header }, cells)
}

fn table(rows: Vec<Node>) -> Document {
    Document {
        source: String::new(),
        children: vec![Node::new(span(), TableData {}, rows)],
    }
}

#[test]
fn tables_have_one_header_and_consistent_columns() {
    let header = || row(true, vec![cell(None), cell(Some(Alignment::Right))]);
    let body = || row(false, vec![cell(None), cell(Some(Alignment::Right))]);
    assert!(
        table(vec![header(), body()])
            .validate(ValidationLimits::default())
            .is_ok()
    );

    for rows in [
        vec![],
        vec![row(false, vec![cell(None)])],
        vec![header(), header()],
        vec![header(), row(false, vec![cell(None)])],
        vec![
            header(),
            row(
                false,
                vec![cell(Some(Alignment::Left)), cell(Some(Alignment::Right))],
            ),
        ],
        vec![
            header(),
            row(false, vec![cell(None), Node::leaf(span(), TableData {})]),
        ],
    ] {
        assert_eq!(
            table(rows).validate(ValidationLimits::default()),
            Err(ValidationError::InvalidNode)
        );
    }
}

#[test]
fn math_nodes_are_leaves() {
    let child = cell(None);
    assert!(
        !Node::new(
            span(),
            InlineMathData { tex: "x".into() },
            vec![child.clone()],
        )
        .validate()
    );
    assert!(!Node::new(span(), BlockMathData { tex: "x".into() }, vec![child],).validate());
}
