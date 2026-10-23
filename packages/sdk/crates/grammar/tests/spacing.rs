use markdown_commonmark_contracts::{Blockquote, List, ListItem, Paragraph};
use markdown_parser::Span;
use markdown_traq_contracts::BlankLine;
use traq_markdown_grammar::Parser;
use traq_markdown_grammar::presets;
use traq_markdown_grammar::syntax::traq;

#[test]
fn source_blank_lines_keep_original_spans() {
    let source = "\n\none\n\n\nthree\n";
    let document = presets::traq::v1::parser().parse(source).unwrap();
    let spans: Vec<_> = document
        .children
        .iter()
        .filter(|node| node.payload::<BlankLine>().is_some())
        .map(|node| node.span)
        .collect();

    assert_eq!(document.source, source);
    assert_eq!(
        spans,
        [
            Span { start: 0, end: 1 },
            Span { start: 1, end: 2 },
            Span { start: 7, end: 8 },
        ]
    );
    assert!(document.children[2].payload::<Paragraph>().is_some());
    assert!(document.children[4].payload::<Paragraph>().is_some());
}

#[test]
fn blank_spacing_stays_inside_quotes_and_list_items() {
    let parser = presets::traq::v1::parser();
    let quote = parser.parse("> one\n>\n>\n> two").unwrap();
    let quote = &quote.children[0];
    assert!(quote.payload::<Blockquote>().is_some());
    assert_eq!(quote.children.len(), 3);
    assert!(quote.children[1].payload::<BlankLine>().is_some());
    assert_eq!(quote.children[1].span, Span { start: 9, end: 12 });

    let list = parser.parse("- one\n\n\n# next").unwrap();
    let list = &list.children[0];
    assert!(list.payload::<List>().unwrap().tight);
    let item = &list.children[0];
    assert!(item.payload::<ListItem>().is_some());
    assert_eq!(item.children.len(), 2);
    assert!(item.children[1].payload::<BlankLine>().is_some());
    assert_eq!(item.children[1].span, Span { start: 7, end: 8 });
}

#[test]
fn empty_quotes_have_no_synthetic_blank_line() {
    let parser = presets::traq::v1::parser();
    for source in [">", "> ", ">\t"] {
        let document = parser.parse(source).unwrap();
        assert_eq!(document.children.len(), 1, "{source:?}");
        let quote = &document.children[0];
        assert!(quote.payload::<Blockquote>().is_some());
        assert_eq!(
            quote.span,
            Span {
                start: 0,
                end: source.len()
            }
        );
        assert!(quote.children.is_empty(), "{source:?}");
    }

    let document = parser.parse(">\n").unwrap();
    let blank = &document.children[0].children[0];
    assert!(blank.payload::<BlankLine>().is_some());
    assert_eq!(blank.span, Span { start: 1, end: 2 });
}

#[test]
fn spacing_is_an_independent_grammar_extension() {
    let mut builder = presets::traq::v1::builder();
    builder
        .remove(
            &builder
                .registration(traq::spacing::plugin())
                .expect("registered preset feature"),
        )
        .unwrap();
    let parser = Parser::new(&builder.build().unwrap());
    let document = parser.parse("one\n\n\nthree\n").unwrap();

    assert_eq!(document.children.len(), 2);
    assert!(
        document
            .children
            .iter()
            .all(|node| node.payload::<Paragraph>().is_some())
    );
}
