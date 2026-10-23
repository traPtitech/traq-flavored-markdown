use markdown_commonmark_contracts::Link;
use markdown_parser::{Limits, Node, ParseError, ValidationLimits};
use markdown_trap_contracts::{Stamp, StampKind};
use traq_markdown_grammar::presets;

fn has_link(nodes: &[Node]) -> bool {
    nodes
        .iter()
        .any(|node| node.get::<Link>().is_some() || has_link(&node.children))
}

#[test]
fn stamp_parser_distinguishes_complete_colors_from_named_stamps() {
    let parser = presets::traq::v1::parser();
    for (source, expected) in [
        (
            ":foo0x123456:",
            StampKind::Normal {
                name: "foo0x123456".into(),
            },
        ),
        (
            ":0x1234567:",
            StampKind::Normal {
                name: "0x1234567".into(),
            },
        ),
        (":0x123456:", StampKind::HexColor { rgb: 0x123456 }),
    ] {
        let document = parser.parse_inline(source).unwrap();
        assert_eq!(document.children.len(), 1, "{source}");
        assert_eq!(document.children[0].get::<Stamp>().unwrap().kind, expected);
    }
    let document = parser.parse_inline(":foohsl(0, 20%, 30%):").unwrap();
    assert!(
        document
            .children
            .iter()
            .all(|node| node.get::<Stamp>().is_none())
    );
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
                document: ValidationLimits {
                    source_bytes: 5,
                    ..ValidationLimits::default()
                },
                ..Limits::default()
            },
            "source_bytes",
        ),
        (
            "**a *b***",
            Limits {
                document: ValidationLimits {
                    depth: 2,
                    ..ValidationLimits::default()
                },
                ..Limits::default()
            },
            "depth",
        ),
        (
            "*a* *b*",
            Limits {
                document: ValidationLimits {
                    nodes: 2,
                    ..ValidationLimits::default()
                },
                ..Limits::default()
            },
            "nodes",
        ),
    ] {
        assert!(
            matches!(presets::traq::v1::parser().with_limits(limits).parse(source),
            Err(ParseError::ResourceLimit { resource: actual }) if actual.as_str() == resource)
        );
    }
}

#[test]
fn syntax_and_rendering_policy_are_separate() {
    let source = "[x](javascript:alert) <file:///a>";
    for parser in [presets::commonmark::parser(), presets::traq::v1::parser()] {
        let document = parser.parse_inline(source).unwrap();
        let destinations: Vec<_> = document
            .children
            .iter()
            .filter_map(|node| node.get::<Link>())
            .map(|link| link.destination.as_str())
            .collect();
        assert_eq!(destinations, ["javascript:alert", "file:///a"]);
    }
}

#[test]
fn intermediate_tokens_syntax_nesting_and_final_tree_limits_are_independent() {
    for (source, limits, resource) in [
        (
            "**a**",
            Limits {
                tokens: 1,
                ..Limits::default()
            },
            "tokens",
        ),
        (
            "[a](/url)",
            Limits {
                nesting: 0,
                ..Limits::default()
            },
            "nesting",
        ),
        (
            "*a*",
            Limits {
                document: ValidationLimits {
                    depth: 1,
                    ..ValidationLimits::default()
                },
                ..Limits::default()
            },
            "depth",
        ),
        (
            "a *b*",
            Limits {
                document: ValidationLimits {
                    nodes: 1,
                    ..ValidationLimits::default()
                },
                ..Limits::default()
            },
            "nodes",
        ),
    ] {
        let result = presets::traq::v1::parser()
            .with_limits(limits)
            .parse_inline(source);
        assert!(
            matches!(result, Err(ParseError::ResourceLimit { resource: actual }) if actual.as_str() == resource),
            "{source}: {resource}"
        );
    }
    assert!(
        presets::traq::v1::parser()
            .with_limits(Limits {
                nesting: 0,
                document: ValidationLimits {
                    nodes: 1,
                    ..ValidationLimits::default()
                },
                ..Limits::default()
            })
            .parse_inline("ordinary text")
            .is_ok()
    );
}
