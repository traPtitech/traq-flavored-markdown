use markdown_commonmark_contracts::{Link, Text};
use markdown_generic_contracts::TableData;
use traq_markdown_grammar::presets;

#[test]
fn table_pipes_follow_backslash_parity() {
    let parser = presets::traq::v1::parser();

    let even = "| a\\\\| b | c |\n| --- | --- | --- |\n| x | y | z |";
    let document = parser.parse(even).unwrap();
    let table = &document.children[0];
    assert!(table.get::<TableData>().is_some());
    assert_eq!(table.children[0].children.len(), 3);
    assert_eq!(
        table.children[0].children[0].children[0]
            .get::<Text>()
            .unwrap()
            .value,
        "a\\"
    );

    let odd = "| a\\\\\\| b | c |\n| --- | --- |\n| x | y |";
    let document = parser.parse(odd).unwrap();
    let table = &document.children[0];
    assert!(table.get::<TableData>().is_some());
    assert_eq!(table.children[0].children.len(), 2);
    assert_eq!(
        table.children[0].children[0].children[0]
            .get::<Text>()
            .unwrap()
            .value,
        "a\\| b"
    );
}

#[test]
fn many_short_links_fit_the_default_work_budget() {
    let source = "http://x ".repeat(1_000);
    let document = presets::traq::v1::parser().parse_inline(&source).unwrap();
    assert_eq!(
        document
            .children
            .iter()
            .filter(|node| node.get::<Link>().is_some())
            .count(),
        1_000
    );
}
