#[path = "support/html.rs"]
mod html;
use markdown_commonmark::{Syntax, html as syntax_html};
use markdown_parser::{GrammarBuilder, Parser};
use serde_json::Value;

#[test]
fn commonmark_0_31_2_specification() {
    let syntax = Syntax::default();
    let mut builder = GrammarBuilder::new();
    builder.add(&syntax.plugin).unwrap();
    builder.add(syntax_html::plugin()).unwrap();
    builder
        .before(syntax_html::inline_rule(), &syntax.inline.entity)
        .unwrap();
    builder
        .before(syntax_html::block_rule(), &syntax.block.heading)
        .unwrap();
    let parser = Parser::new(&builder.build().unwrap());
    let cases: Vec<Value> = serde_json::from_str(include_str!(
        "../../../tests/fixtures/commonmark-0.31.2.json"
    ))
    .unwrap();
    assert_eq!(cases.len(), 652);
    for case in cases {
        let document = parser.parse(case["markdown"].as_str().unwrap()).unwrap();
        assert_eq!(
            html::render(&document.children),
            case["html"].as_str().unwrap(),
            "CommonMark example {} ({})",
            case["example"],
            case["section"]
        );
    }
}
