#[path = "support/html.rs"]
mod html;
use markdown_commonmark::{Syntax, html as syntax_html};
use markdown_parser::{GrammarBuilder, Parser};
use serde_json::Value;

fn parser() -> Parser {
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
    Parser::new(&builder.build().unwrap())
}

#[test]
fn commonmark_0_31_2_specification() {
    let parser = parser();
    let cases: Vec<Value> = serde_json::from_str(include_str!(
        "../../../../../../tests/fixtures/commonmark-0.31.2.json"
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

#[test]
fn atx_heading_preserves_unicode_whitespace() {
    let parser = parser();

    for (source, expected) in [
        ("# \u{3000}title", "<h1>\u{3000}title</h1>\n"),
        ("# title\u{3000}", "<h1>title\u{3000}</h1>\n"),
        ("# title\u{3000} ###", "<h1>title\u{3000}</h1>\n"),
        ("# title ###\u{3000}", "<h1>title ###\u{3000}</h1>\n"),
    ] {
        let document = parser.parse(source).unwrap();
        assert_eq!(html::render(&document.children), expected);
    }
}
