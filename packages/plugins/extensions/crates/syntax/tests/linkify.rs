use markdown_commonmark_contracts::{Link, LinkForm, Text};
use markdown_parser::GrammarBuilder;
use markdown_parser::Parser;

fn parser() -> Parser {
    let commonmark = markdown_commonmark::Syntax::new();
    let linkify = markdown_extensions_syntax::linkify::Syntax::new();
    let mut builder = GrammarBuilder::new();
    builder.add(&commonmark.plugin).unwrap();
    builder.add(&linkify.plugin).unwrap();
    Parser::new(&builder.build().unwrap())
}

#[test]
fn bare_urls_domains_emails_and_mentions_remain_text() {
    let parser = parser();
    for source in [
        "trap.jp",
        "example.com",
        "example.org",
        "README.md",
        "https://trap.jp/path?q=1#part",
        "http://trap.jp",
        "ftp://trap.jp",
        "//trap.jp",
        "info@trap.jp",
        "contact@midorimu.si",
        "mailto:info@trap.jp",
        "@gmai.com",
    ] {
        let document = parser.parse_inline(source).unwrap();
        assert_eq!(document.children.len(), 1, "{source}");
        assert_eq!(
            document.children[0].payload::<Text>().unwrap().value,
            source
        );
    }
}

#[test]
fn angle_domains_complete_only_the_destination_without_a_tld_allowlist() {
    let parser = parser();
    for (value, expected) in [
        ("trap.jp", "https://trap.jp"),
        ("README.md", "https://readme.md"),
        ("host.internal", "https://host.internal"),
        ("//trap.jp", "https://trap.jp"),
        (
            "//README.md:8443/Path?q=Value#Part",
            "https://readme.md:8443/Path?q=Value#Part",
        ),
        (
            "trap.jp/a_(b).?q=%20&x=1",
            "https://trap.jp/a_(b).?q=%20&x=1",
        ),
        (
            "日本語.jp/日本",
            "https://xn--wgv71a119e.jp/%E6%97%A5%E6%9C%AC",
        ),
    ] {
        let source = format!("<{value}>");
        let document = parser.parse_inline(&source).unwrap();
        assert_eq!(document.source, source);
        assert_eq!(document.children.len(), 1, "{source}");
        let node = &document.children[0];
        let link = node.payload::<Link>().unwrap();
        assert_eq!(link.destination, expected, "{source}");
        assert_eq!(link.form, LinkForm::Autolink);
        assert_eq!(node.span.start, 0);
        assert_eq!(node.span.end, source.len());
        assert_eq!(node.children[0].payload::<Text>().unwrap().value, value);
        assert_eq!(node.children[0].span.start, 1);
        assert_eq!(node.children[0].span.end, source.len() - 1);
    }
}

#[test]
fn commonmark_autolinks_keep_their_schemes_and_email_rules() {
    let parser = parser();
    for (value, expected) in [
        ("https://trap.jp", "https://trap.jp"),
        ("http://trap.jp", "http://trap.jp"),
        ("ftp://trap.jp", "ftp://trap.jp"),
        ("custom:README.md", "custom:README.md"),
        ("trap.jp:443/path", "trap.jp:443/path"),
        ("info@trap.jp", "mailto:info@trap.jp"),
        ("contact@midorimu.si", "mailto:contact@midorimu.si"),
        ("a@b", "mailto:a@b"),
    ] {
        let document = parser.parse_inline(&format!("<{value}>")).unwrap();
        let node = &document.children[0];
        assert_eq!(node.payload::<Link>().unwrap().destination, expected);
        assert_eq!(node.children[0].payload::<Text>().unwrap().value, value);
    }
}

#[test]
fn malformed_domains_and_opaque_or_escaped_contexts_do_not_create_links() {
    let parser = parser();
    for source in [
        "<span>",
        "<README>",
        "<@gmai.com>",
        "<.trap.jp>",
        "<trap..jp>",
        "<-trap.jp>",
        "<trap.jp->",
        "<//trap.jp:65536>",
        "<//trap.jp:123456>",
        "<trap.jp/a b>",
        "<trap.jp",
        "`<trap.jp>`",
        r"\<trap.jp>",
        "&lt;trap.jp&gt;",
    ] {
        let document = parser.parse_inline(source).unwrap();
        assert!(
            document
                .children
                .iter()
                .all(|node| node.payload::<Link>().is_none()),
            "{source}"
        );
    }
    let source = format!("<{}.jp>", "a".repeat(64));
    assert!(
        parser
            .parse_inline(&source)
            .unwrap()
            .children
            .iter()
            .all(|node| node.payload::<Link>().is_none())
    );
}
