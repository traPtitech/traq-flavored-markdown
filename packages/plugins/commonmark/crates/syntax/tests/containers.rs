#[path = "support/html.rs"]
mod html;

use markdown_commonmark::Syntax;
use markdown_commonmark_contracts::{CodeBlock, List, Paragraph};
use markdown_parser::{GrammarBuilder, Parser};

fn parser() -> Parser {
    let syntax = Syntax::default();
    let mut builder = GrammarBuilder::new();
    builder.add(&syntax.plugin).unwrap();
    Parser::new(&builder.build().unwrap())
}

#[test]
fn lazy_quote_continuations_cannot_start_nested_lists() {
    let parser = parser();
    for source in [
        "> - parent\n    - child",
        "> - parent\n\t- child",
        "> - parent\r\n    - child",
        "> - parent\n    - child\n    - another",
    ] {
        let document = parser.parse(source).unwrap();
        let continuation = if source.ends_with("another") {
            "- child\n- another"
        } else {
            "- child"
        };
        assert_eq!(
            html::render(&document.children),
            format!("<blockquote>\n<ul>\n<li>parent\n{continuation}</li>\n</ul>\n</blockquote>\n"),
            "{source:?}"
        );
    }
}

#[test]
fn quoted_list_prefixes_and_inherited_lazy_lines_stay_distinct() {
    let parser = parser();
    for (source, expected) in [
        (
            "> - parent\n>   - child",
            "<blockquote>\n<ul>\n<li>parent\n<ul>\n<li>child</li>\n</ul>\n</li>\n</ul>\n</blockquote>\n",
        ),
        (
            "> > - parent\n      - child",
            "<blockquote>\n<blockquote>\n<ul>\n<li>parent\n- child</li>\n</ul>\n</blockquote>\n</blockquote>\n",
        ),
        (
            "> - parent\n    1. child",
            "<blockquote>\n<ul>\n<li>parent\n1. child</li>\n</ul>\n</blockquote>\n",
        ),
    ] {
        assert_eq!(
            html::render(&parser.parse(source).unwrap().children),
            expected,
            "{source:?}"
        );
    }
}

#[test]
fn unquoted_ordered_lists_end_quotes_at_any_start_number() {
    let parser = parser();
    for marker in ["0.", "7.", "7)", "123456789."] {
        let source = format!("> quote\n{marker} item\nnext");
        let start = marker[..marker.len() - 1].parse::<u32>().unwrap();
        assert_eq!(
            html::render(&parser.parse(&source).unwrap().children),
            format!(
                "<blockquote>\n<p>quote</p>\n</blockquote>\n<ol start=\"{start}\">\n<li>item\nnext</li>\n</ol>\n"
            ),
            "{source:?}"
        );
    }

    for source in ["paragraph\n7. item", "> paragraph\n> 7. item"] {
        let html = html::render(&parser.parse(source).unwrap().children);
        assert!(!html.contains("<ol"), "{source:?}: {html}");
    }
}

#[test]
fn code_between_paragraphs_does_not_loosen_a_list_without_blank_lines() {
    let parser = parser();
    for separator in ["", "\n"] {
        let source = format!("- example\n  ```\n  code\n  ```\n{separator}  explanation");
        let document = parser.parse(&source).unwrap();
        let list = &document.children[0];
        assert_eq!(list.payload::<List>().unwrap().tight, separator.is_empty());
        let children = &list.children[0].children;
        assert_eq!(children.len(), 3);
        assert!(children[0].payload::<Paragraph>().is_some());
        assert!(children[1].payload::<CodeBlock>().is_some());
        assert!(children[2].payload::<Paragraph>().is_some());
    }

    let source = "1. parent\n   - first\n   - example\n     ```\n     code\n     ```\n     explanation\n\n2. next";
    let document = parser.parse(source).unwrap();
    let outer = &document.children[0];
    assert!(!outer.payload::<List>().unwrap().tight);
    let inner = &outer.children[0].children[1];
    assert!(inner.payload::<List>().unwrap().tight);

    let document = parser
        .parse("- parent\n  - child\n\n  explanation")
        .unwrap();
    assert!(!document.children[0].payload::<List>().unwrap().tight);
}
