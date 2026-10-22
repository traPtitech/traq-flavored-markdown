use markdown_ast::{
    Document, Node, NodeData, NodeRole, Span, ValidationErrorKind, ValidationLimits,
};
use markdown_generic_contracts::{Alignment, BlockMath, Cell, HeaderRow, InlineMath, Row, Table};

fn span() -> Span {
    Span { start: 0, end: 0 }
}

fn cell() -> Node {
    Node::leaf(span(), Cell {})
}

fn row(header: bool, cells: Vec<Node>) -> Node {
    Node::new(
        span(),
        if header {
            markdown_ast::NodeKind::new(HeaderRow {})
        } else {
            markdown_ast::NodeKind::new(Row {})
        },
        cells,
    )
}

fn table(rows: Vec<Node>) -> Document {
    Document {
        source: String::new(),
        children: vec![Node::new(
            span(),
            Table {
                alignments: vec![None, Some(Alignment::Right)],
            },
            rows,
        )],
    }
}

#[test]
fn tables_have_one_header_and_columns_are_defined_once() {
    let header = || row(true, vec![cell(), cell()]);
    let body = || row(false, vec![cell(), cell()]);
    assert!(
        table(vec![header(), body()])
            .validate(ValidationLimits::default())
            .is_ok()
    );
    for rows in [
        vec![],
        vec![body()],
        vec![header(), header()],
        vec![header(), row(false, vec![cell()])],
        vec![
            header(),
            row(
                false,
                vec![cell(), Node::leaf(span(), Table { alignments: vec![] })],
            ),
        ],
    ] {
        assert_eq!(
            table(rows)
                .validate(ValidationLimits::default())
                .map_err(|error| error.kind),
            Err(ValidationErrorKind::InvalidNode)
        );
    }
    let mut empty_columns = table(vec![header()]);
    empty_columns.children[0]
        .get_mut::<Table>()
        .unwrap()
        .alignments
        .clear();
    assert!(empty_columns.validate(ValidationLimits::default()).is_err());
}

#[test]
fn math_nodes_are_leaves() {
    let child = cell();
    assert!(
        Node::new(span(), InlineMath { tex: "x".into() }, vec![child.clone()],)
            .validate()
            .is_err()
    );
    assert!(
        Node::new(span(), BlockMath { tex: "x".into() }, vec![child],)
            .validate()
            .is_err()
    );
}

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

#[test]
fn table_cells_accept_external_inline_nodes_only() {
    assert!(
        Node::new(span(), Cell {}, vec![Node::leaf(span(), ExternalInline)])
            .validate()
            .is_ok()
    );
    assert!(
        Node::new(span(), Cell {}, vec![Node::leaf(span(), ExternalBlock)])
            .validate()
            .is_err()
    );
}
