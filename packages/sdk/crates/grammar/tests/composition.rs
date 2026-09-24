use markdown_commonmark_contracts::{HtmlInline, Text};
use markdown_definitions::Plugin as Declaration;
use markdown_generic_syntax::math::InlineMathData;
use markdown_parser::{NodeData, NodeRole};
use traq_markdown_grammar::{
    Parser,
    engine::{
        Plugin,
        inline::{InlineMatch, InlineRule},
    },
    presets,
    syntax::extensions,
};

#[derive(Debug, Clone, PartialEq)]
struct ExternalNode;
impl NodeData for ExternalNode {
    fn role(&self) -> NodeRole {
        NodeRole::Inline
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}

#[test]
fn third_party_syntax_can_extend_a_published_preset() {
    let mut external = Plugin::new(&Declaration::new("external"));
    external.add(InlineRule::new(b"^", |input, _| {
        Ok(Some(InlineMatch::leaf(
            input.position + 1,
            ExternalNode.into(),
        )))
    }));

    let mut builder = presets::traq::v1::builder();
    builder.add(&external).unwrap();
    let parser = Parser::new(&builder.build().unwrap());

    let document = parser.parse_inline("before ^ after").unwrap();
    assert!(
        document
            .children
            .iter()
            .any(|node| node.get::<ExternalNode>().is_some())
    );

    let nested = parser.parse("before ^ after").unwrap();
    assert!(nested.children.iter().any(|paragraph| {
        paragraph
            .children
            .iter()
            .any(|node| node.get::<ExternalNode>().is_some())
    }));
}

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
