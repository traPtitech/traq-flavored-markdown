use markdown_commonmark_contracts::{HtmlInline, Text};
use markdown_definitions::PluginDeclaration as Declaration;
use markdown_extensions_syntax::math::InlineMath;
use markdown_parser::NodeData;
use markdown_parser::NodeRole;
use traq_markdown_grammar::Parser;
use traq_markdown_grammar::grammar::SyntaxPlugin;
use traq_markdown_grammar::presets;
use traq_markdown_grammar::rules::inline::InlineMatch;
use traq_markdown_grammar::rules::inline::InlineRule;
use traq_markdown_grammar::syntax::extensions;

#[derive(Debug, Clone, PartialEq)]
struct ExternalNode;
impl NodeData for ExternalNode {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure {
            role: NodeRole::Inline,
            children: markdown_ast::ChildStructure::Any,
        };
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}

#[test]
fn third_party_syntax_can_extend_a_published_preset() {
    let mut external = SyntaxPlugin::new(&Declaration::new("external"));
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
            .any(|node| node.payload::<ExternalNode>().is_some())
    );

    let nested = parser.parse("before ^ after").unwrap();
    assert!(nested.children.iter().any(|paragraph| {
        paragraph
            .children
            .iter()
            .any(|node| node.payload::<ExternalNode>().is_some())
    }));
}

#[test]
fn removing_an_extension_does_not_change_an_existing_parser() {
    let original = presets::traq::v1::parser();
    let mut builder = presets::traq::v1::builder();
    builder
        .remove(
            &builder
                .registration(extensions::math::plugin())
                .expect("registered preset feature"),
        )
        .unwrap();
    let customized = Parser::new(&builder.build().unwrap());
    let plain = customized.parse_inline("$x$").unwrap();
    assert_eq!(plain.children[0].payload::<Text>().unwrap().value, "$x$");
    let math = original.parse_inline("$x$").unwrap();
    assert_eq!(math.children[0].payload::<InlineMath>().unwrap().tex, "x");
}

#[test]
fn commonmark_html_is_opted_out_in_traq() {
    let commonmark = presets::commonmark::parser().parse_inline("<b>").unwrap();
    assert!(commonmark.children[0].payload::<HtmlInline>().is_some());
    let traq = presets::traq::v1::parser().parse_inline("<b>").unwrap();
    assert_eq!(traq.children[0].payload::<Text>().unwrap().value, "<b>");
}
