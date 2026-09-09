use markdown_commonmark_contracts::{Link, Text};
use markdown_parser::{Limits, Node, ParseError};
use traq_markdown_grammar::presets;

fn has_link(nodes: &[Node]) -> bool {
    nodes
        .iter()
        .any(|node| node.get::<Link>().is_some() || has_link(&node.children))
}

#[test]
fn parser_and_dispatch_can_be_shared_without_leaking_references() {
    let parser = presets::traq::v1::parser();
    std::thread::scope(|scope| {
        for _ in 0..4 {
            scope.spawn(|| {
                for _ in 0..10 {
                    assert!(has_link(
                        &parser.parse("[a][r]\n\n[r]: /here").unwrap().children
                    ));
                    assert!(!has_link(&parser.parse("[a][r]").unwrap().children));
                }
            });
        }
    });
}

#[test]
fn limits_cover_multibyte_input_and_nested_results() {
    for (source, limits, resource) in [
        (
            "日本",
            Limits {
                input_bytes: 5,
                ..Limits::default()
            },
            "input_bytes",
        ),
        (
            "**a *b***",
            Limits {
                depth: 2,
                ..Limits::default()
            },
            "depth",
        ),
        (
            "*a* *b*",
            Limits {
                nodes: 2,
                ..Limits::default()
            },
            "tokens",
        ),
    ] {
        assert!(
            matches!(presets::traq::v1::parser().with_limits(limits).parse(source),
            Err(ParseError::ResourceLimit { resource: actual }) if actual == resource)
        );
    }
}

#[test]
fn syntax_and_rendering_policy_are_separate() {
    let source = "[x](javascript:alert) <file:///a>";
    let commonmark = presets::commonmark::parser().parse_inline(source).unwrap();
    assert_eq!(
        commonmark
            .children
            .iter()
            .filter(|n| n.get::<Link>().is_some())
            .count(),
        2
    );
    let traq = presets::traq::v1::parser().parse_inline(source).unwrap();
    assert!(traq.children.iter().all(|n| n.get::<Text>().is_some()));
}
