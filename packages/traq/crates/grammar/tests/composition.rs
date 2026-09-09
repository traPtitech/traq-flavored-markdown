use markdown_commonmark_contracts::{HtmlInline, Text};
use markdown_generic_syntax::math::InlineMathData;
use traq_markdown_grammar::{Parser, presets, syntax::extensions};

#[test]
fn removing_an_extension_does_not_change_an_existing_parser() {
    let original = presets::traq::v1::parser();
    let mut builder = presets::traq::v1::builder();
    builder.remove(extensions::math::plugin()).unwrap();
    let customized = Parser::new(&builder.build().unwrap());
    let plain = customized.parse_inline("$x$").unwrap();
    assert_eq!(plain.children[0].get::<Text>().unwrap().value, "$x$");
    let math = original.parse_inline("$x$").unwrap();
    assert_eq!(math.children[0].get::<InlineMathData>().unwrap().tex, "x");
}

#[test]
fn commonmark_html_is_opted_out_in_traq() {
    let commonmark = presets::commonmark::parser().parse_inline("<b>").unwrap();
    assert!(commonmark.children[0].get::<HtmlInline>().is_some());
    let traq = presets::traq::v1::parser().parse_inline("<b>").unwrap();
    assert_eq!(traq.children[0].get::<Text>().unwrap().value, "<b>");
}
