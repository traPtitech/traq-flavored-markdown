use markdown_parser::{
    Node, Span,
    syntax::{NodeSyntax, SyntaxTree},
};
use traq_markdown_grammar::presets;

fn validate_spans(source: &str, spans: impl IntoIterator<Item = Span>) {
    for span in spans {
        assert!(
            source.get(span.start..span.end).is_some(),
            "{span:?} in {source:?}"
        );
    }
}

fn validate_children(source: &str, nodes: &[Node], syntax: &[NodeSyntax]) {
    assert_eq!(nodes.len(), syntax.len(), "{source:?}");

    for (node, syntax) in nodes.iter().zip(syntax) {
        validate_spans(source, [node.span]);

        if let Some(facts) = &syntax.source {
            validate_spans(source, facts.content.iter().copied());

            for marker in &facts.markers {
                validate_spans(source, marker.spans.iter().copied());
            }
        }

        validate_children(source, &node.children, &syntax.children);
    }
}

fn validate_syntax(source: &str, nodes: &[Node], syntax: &SyntaxTree) {
    validate_children(source, nodes, &syntax.children);

    for marker in &syntax.detached {
        validate_spans(source, marker.spans.iter().copied());
    }
}

#[test]
fn composed_sources_preserve_ast_shape_and_utf8_boundaries() {
    let parser = presets::traq::v1::parser();
    let fragments = [
        "日😀",
        "\0",
        "\r\n",
        "\t",
        "**a**",
        "[x](https://example.com)",
        "`x`",
        "$x$",
        "\\*",
        "&amp;",
        ":stamp:",
        "[ref]: /target\n",
        "> a\n",
        "- a\n",
        "```\na\n```\n",
        "| a |\n| --- |\n| b |\n",
    ];

    for left in fragments {
        for right in fragments {
            for source in [
                format!("{left}{right}"),
                format!("> {left}\n> {right}"),
                format!("**{left} _{right}_**"),
            ] {
                let document = parser.parse(&source).unwrap();
                let captured = parser.parse_with_syntax(&source).unwrap();

                assert_eq!(document.children, captured.document.children, "{source:?}");
                validate_syntax(&source, &document.children, &captured.syntax);

                let inline = parser.parse_inline(&source).unwrap();
                let captured = parser.parse_inline_with_syntax(&source).unwrap();

                assert_eq!(inline.children, captured.document.children, "{source:?}");
                validate_syntax(&source, &inline.children, &captured.syntax);
            }
        }
    }
}
