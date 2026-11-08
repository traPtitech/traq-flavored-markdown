use markdown_commonmark_contracts::{CodeBlock, Heading, Image, InlineCode, ListItem, Strong};
use markdown_parser::{
    Node, NodeData, Span,
    syntax::{MarkerKind, NodeSyntax, SourceSyntax},
};
use traq_markdown_grammar::presets;

fn find<T: NodeData>(nodes: &[Node], syntax: &[NodeSyntax]) -> SourceSyntax {
    assert_eq!(nodes.len(), syntax.len());

    for (node, syntax) in nodes.iter().zip(syntax) {
        if node.payload::<T>().is_some() {
            return syntax.source.clone().expect("source facts");
        }

        if contains::<T>(&node.children) {
            return find::<T>(&node.children, &syntax.children);
        }
    }

    panic!("node not found")
}

fn contains<T: NodeData>(nodes: &[Node]) -> bool {
    nodes
        .iter()
        .any(|node| node.payload::<T>().is_some() || contains::<T>(&node.children))
}

fn slices<'a>(source: &'a str, spans: &[Span]) -> Vec<&'a str> {
    spans
        .iter()
        .map(|span| &source[span.start..span.end])
        .collect()
}

#[test]
fn source_capture_preserves_the_ast_and_exact_marker_pairing() {
    let parser = presets::traq::v1::parser();

    for source in [
        "***a***",
        "> 😀 **a\r\n> b**",
        "\\*literal* **unfinished `**code**`",
        "[**label**](https://example.com/a_(b))",
        "| **a** |\n| --- |\n| b\\|c |",
    ] {
        let parsed = parser.parse_with_syntax(source).unwrap();

        assert_eq!(
            parsed.document.children,
            parser.parse(source).unwrap().children
        );
    }

    let source = "> 😀 **a\r\n> b**";
    let parsed = parser.parse_with_syntax(source).unwrap();
    let facts = find::<Strong>(&parsed.document.children, &parsed.syntax.children);

    assert_eq!(slices(source, &facts.content), ["a\r\n", "b"]);

    assert_eq!(
        facts
            .markers
            .iter()
            .map(|marker| marker.kind)
            .collect::<Vec<_>>(),
        [MarkerKind::Open, MarkerKind::Close]
    );

    assert_eq!(
        facts
            .markers
            .iter()
            .flat_map(|marker| slices(source, &marker.spans))
            .collect::<Vec<_>>(),
        ["**", "**"]
    );

    let source = "`` a ` b ``";
    let parsed = parser.parse_inline_with_syntax(source).unwrap();
    let facts = find::<InlineCode>(&parsed.document.children, &parsed.syntax.children);

    assert_eq!(slices(source, &facts.content), [" a ` b "]);

    assert_eq!(
        parsed.document.children[0]
            .payload::<InlineCode>()
            .unwrap()
            .literal,
        "a ` b"
    );
}

#[test]
fn block_syntax_retains_closed_unclosed_and_indented_code_sources() {
    let parser = presets::traq::v1::parser();

    for (source, content, close) in [
        ("> ```rs\r\n> x\r\n> ```", vec!["x\r\n"], true),
        ("```rs\nx", vec!["x"], false),
        ("    x\n    y", vec!["x\n", "y"], false),
    ] {
        let parsed = parser.parse_with_syntax(source).unwrap();
        let facts = find::<CodeBlock>(&parsed.document.children, &parsed.syntax.children);

        assert_eq!(slices(source, &facts.content), content);

        assert_eq!(
            facts
                .markers
                .iter()
                .any(|marker| marker.kind == MarkerKind::Close),
            close
        );
    }

    for (source, content, marker) in [
        ("## title ##", "title", "## "),
        ("title\n---", "title", "---"),
    ] {
        let parsed = parser.parse_with_syntax(source).unwrap();
        let facts = find::<Heading>(&parsed.document.children, &parsed.syntax.children);

        assert_eq!(slices(source, &facts.content), [content]);
        assert_eq!(slices(source, &facts.markers[0].spans), [marker]);
    }
}

#[test]
fn reference_definitions_and_partial_tab_prefixes_keep_their_source_facts() {
    let parser = presets::traq::v1::parser();
    let source = "![alt][asset]\n\n[asset]: https://example.com/image.png";
    let parsed = parser.parse_with_syntax(source).unwrap();
    let image = find::<Image>(&parsed.document.children, &parsed.syntax.children);

    assert_eq!(slices(source, &image.content), ["alt"]);
    assert_eq!(parsed.syntax.detached.len(), 1);
    assert_eq!(parsed.syntax.detached[0].kind, MarkerKind::Definition);

    assert_eq!(
        slices(source, &parsed.syntax.detached[0].spans),
        ["[asset]: https://example.com/image.png"]
    );

    let source = "- a\n\t**b**";
    let parsed = parser.parse_with_syntax(source).unwrap();
    let item = find::<ListItem>(&parsed.document.children, &parsed.syntax.children);

    let prefixes: Vec<_> = item
        .markers
        .iter()
        .filter(|marker| marker.kind == MarkerKind::Prefix)
        .collect();

    assert_eq!(prefixes.len(), 2);
    assert_eq!(slices(source, &prefixes[1].spans), ["\t"]);
    assert_eq!(prefixes[1].columns, Some(2));
    let strong = find::<Strong>(&parsed.document.children, &parsed.syntax.children);

    assert_eq!(slices(source, &strong.content), ["b"]);
}

#[test]
fn invalid_external_source_facts_fail_without_changing_normal_parsing() {
    use markdown_definitions::PluginDeclaration;

    use markdown_parser::{
        ParseError, Parser, SyntaxPlugin,
        rules::inline::{InlineMatch, InlineRule},
    };

    let mut plugin = SyntaxPlugin::new(&PluginDeclaration::new("invalid-source"));

    plugin.add(InlineRule::new(b"^", |input, _| {
        Ok(Some(InlineMatch::leaf_with_syntax(
            input.position + 1,
            markdown_commonmark_contracts::Text { value: "^".into() }.into(),
            Some(SourceSyntax {
                content: vec![Span { start: 0, end: 100 }],
                markers: vec![],
            }),
        )))
    }));

    let mut builder = presets::traq::v1::builder();
    builder.add(&plugin).unwrap();
    let parser = Parser::new(&builder.build().unwrap());

    assert!(parser.parse("^").is_ok());

    assert!(matches!(
        parser.parse_with_syntax("^"),
        Err(ParseError::InvalidRuleOutput {
            phase: markdown_parser::ParsePhase::Inline,
            ..
        })
    ));

    assert!(parser.parse_with_syntax("after").is_ok());
}

#[test]
fn repeated_origin_scans_in_nested_emphasis_obey_the_work_limit() {
    use markdown_parser::{Limits, ParseError, ParseResource};

    let source = format!(
        "{}{}{}",
        "*a ".repeat(40),
        "\0".repeat(3000),
        " z*".repeat(40)
    );

    assert!(
        presets::traq::v1::parser()
            .parse_inline_with_syntax(&source)
            .is_ok()
    );

    let parser = presets::traq::v1::parser().with_limits(Limits {
        work: 75_000,
        ..Limits::default()
    });

    assert!(parser.parse_inline(&source).is_ok());

    assert!(matches!(
        parser.parse_inline_with_syntax(&source),
        Err(ParseError::ResourceLimit {
            resource: ParseResource::Work
        })
    ));
}
