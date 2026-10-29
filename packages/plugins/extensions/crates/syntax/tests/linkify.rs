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
fn scheme_less_domains_and_mentions_remain_text() {
    let parser = parser();
    for source in [
        "trap.jp",
        "example.com",
        "example.org",
        "README.md",
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
fn scheme_relative_urls_complete_https_and_keep_the_label_and_range() {
    let parser = parser();
    for (source, destination, label) in [
        ("//trap.jp", "https://trap.jp", "//trap.jp"),
        ("//README.md", "https://readme.md", "//README.md"),
        (
            "//trap.jp:8443/a_(b)?q=1#part",
            "https://trap.jp:8443/a_(b)?q=1#part",
            "//trap.jp:8443/a_(b)?q=1#part",
        ),
        (
            "//日本語.jp/日本",
            "https://xn--wgv71a119e.jp/%E6%97%A5%E6%9C%AC",
            "//日本語.jp/日本",
        ),
        (
            "//127.0.0.1/path",
            "https://127.0.0.1/path",
            "//127.0.0.1/path",
        ),
        (
            "//[::1]:8443/path",
            "https://[::1]:8443/path",
            "//[::1]:8443/path",
        ),
    ] {
        let document = parser.parse_inline(source).unwrap();
        assert_eq!(document.children.len(), 1, "{source}");
        let node = &document.children[0];
        let link = node.payload::<Link>().unwrap();
        assert_eq!(link.destination, destination, "{source}");
        assert_eq!(link.form, LinkForm::Linkify);
        assert_eq!(node.span.start, 0);
        assert_eq!(node.span.end, source.len());
        assert_eq!(node.children[0].payload::<Text>().unwrap().value, label);
    }
}

#[test]
fn scheme_relative_urls_respect_markdown_and_token_boundaries() {
    let parser = parser();
    for (source, destination) in [
        ("(//trap.jp/a_(b)).", "https://trap.jp/a_(b)"),
        (
            "**//trap.jp/@alice#channel**",
            "https://trap.jp/@alice#channel",
        ),
        ("[//trap.jp/path]", "https://trap.jp/path"),
        ("[//inner.test](https://outer.test)", "https://outer.test"),
        ("[label](//trap.jp/path)", "//trap.jp/path"),
    ] {
        let document = parser.parse_inline(source).unwrap();
        fn collect<'a>(nodes: &'a [markdown_parser::Node], links: &mut Vec<&'a Link>) {
            for node in nodes {
                if let Some(link) = node.payload::<Link>() {
                    links.push(link);
                }
                collect(&node.children, links);
            }
        }
        let mut links = Vec::new();
        collect(&document.children, &mut links);
        assert_eq!(links.len(), 1, "{source}");
        assert_eq!(links[0].destination, destination, "{source}");
    }
    for source in [
        "`//trap.jp`",
        r"\//trap.jp",
        "&#47;/trap.jp",
        "/trap.jp",
        "./trap.jp",
        "../trap.jp",
        "///trap.jp",
        "foo//trap.jp",
        "custom://trap.jp",
        "file://trap.jp/path",
        "https&#58;//trap.jp",
        "// コメント",
        "//TODO",
        "//localhost",
        "//trap..jp",
        "//trap.jp:65536",
        "//trap.jp:123456",
        "//trap.jp:3000abc",
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
}

#[test]
fn repeated_slashes_and_comment_like_tokens_remain_text_with_linear_work() {
    for source in ["/".repeat(4_000), "//TODO".repeat(1_000)] {
        let document = parser()
            .with_limits(markdown_parser::Limits {
                work: source.len() * 32,
                ..markdown_parser::Limits::default()
            })
            .parse_inline(&source)
            .unwrap();
        assert!(
            document
                .children
                .iter()
                .all(|node| node.payload::<Link>().is_none())
        );
    }
}

#[test]
fn bare_emails_link_to_mailto_without_a_tld_allowlist() {
    let parser = parser();
    for value in [
        "info@trap.jp",
        "contact@midorimu.si",
        "first.last+tag@example.test",
        "Info@example.com",
    ] {
        let document = parser.parse_inline(value).unwrap();
        assert_eq!(document.children.len(), 1, "{value}");
        let node = &document.children[0];
        let link = node.payload::<Link>().unwrap();
        assert_eq!(link.destination, format!("mailto:{value}"));
        assert_eq!(link.form, LinkForm::Linkify);
        assert_eq!(node.children[0].payload::<Text>().unwrap().value, value);
        assert_eq!(node.span.start, 0);
        assert_eq!(node.span.end, value.len());
        assert_eq!(node.children[0].span, node.span);
    }
    let document = parser.parse_inline("mailto:info@trap.jp").unwrap();
    assert_eq!(
        document.children[0].payload::<Link>().unwrap().destination,
        "mailto:info@trap.jp"
    );
}

#[test]
fn email_boundaries_keep_mentions_code_and_explicit_links_intact() {
    let parser = parser();
    for source in [
        "@gmai.com",
        "@alice",
        "@alice@example.com",
        "alice@@example.com",
        "alice@example..com",
        "alice@example.com-",
        "alice@-example.com",
        "alice@host",
        "ſ@example.com",
        "foo@K.example",
        "`info@trap.jp`",
        "info\\@trap.jp",
        "info&#64;trap.jp",
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
    for source in [
        "(info@trap.jp).",
        "**info@trap.jp**",
        "[info@trap.jp]",
        "[info@trap.jp](https://trap.jp)",
    ] {
        let document = parser.parse_inline(source).unwrap();
        fn count(nodes: &[markdown_parser::Node]) -> usize {
            nodes
                .iter()
                .map(|node| usize::from(node.payload::<Link>().is_some()) + count(&node.children))
                .sum()
        }
        assert_eq!(count(&document.children), 1, "{source}");
    }
    let source = "https://example.com/@alice?contact=info@trap.jp";
    let document = parser.parse_inline(source).unwrap();
    assert_eq!(document.children.len(), 1);
    assert_eq!(
        document.children[0].payload::<Link>().unwrap().destination,
        source
    );
    assert!(document.children[0].children[0].payload::<Text>().is_some());
}

#[test]
fn scheme_urls_are_linkified_with_their_original_source_ranges() {
    let parser = parser();
    for (source, destination, label) in [
        (
            "https://trap.jp/path?q=1#part",
            "https://trap.jp/path?q=1#part",
            "https://trap.jp/path?q=1#part",
        ),
        (
            "http://localhost:3000/path",
            "http://localhost:3000/path",
            "http://localhost:3000/path",
        ),
        (
            "ftp://trap.jp/file",
            "ftp://trap.jp/file",
            "ftp://trap.jp/file",
        ),
        ("HTTPS://trap.jp", "HTTPS://trap.jp", "HTTPS://trap.jp"),
        (
            "https://[::1]:8443/path",
            "https://[::1]:8443/path",
            "https://[::1]:8443/path",
        ),
        (
            "https://日本語.jp/日本",
            "https://xn--wgv71a119e.jp/%E6%97%A5%E6%9C%AC",
            "https://日本語.jp/日本",
        ),
        (
            "https://trap.jp/%E6%97%A5%E6%9C%AC?q=%2F",
            "https://trap.jp/%E6%97%A5%E6%9C%AC?q=%2F",
            "https://trap.jp/日本?q=%2F",
        ),
    ] {
        let document = parser.parse_inline(source).unwrap();
        assert_eq!(document.children.len(), 1, "{source}");
        let node = &document.children[0];
        let link = node.payload::<Link>().unwrap();
        assert_eq!(link.destination, destination, "{source}");
        assert_eq!(link.form, LinkForm::Linkify);
        assert_eq!(node.span.start, 0);
        assert_eq!(node.span.end, source.len());
        assert_eq!(node.children[0].payload::<Text>().unwrap().value, label);
        assert_eq!(node.children[0].span, node.span);
    }
}

#[test]
fn bare_url_boundaries_preserve_punctuation_and_markdown_context() {
    let parser = parser();
    for (source, destination) in [
        ("(https://trap.jp/a_(b)).", "https://trap.jp/a_(b)"),
        (
            "接続先https://trap.jp/@alice#channel",
            "https://trap.jp/@alice#channel",
        ),
        ("**https://trap.jp/path**", "https://trap.jp/path"),
        ("[https://trap.jp/path]", "https://trap.jp/path"),
        ("[label](https://trap.jp/path)", "https://trap.jp/path"),
        (
            "[https://inner.test](https://outer.test)",
            "https://outer.test",
        ),
    ] {
        let document = parser.parse_inline(source).unwrap();
        fn links<'a>(nodes: &'a [markdown_parser::Node], result: &mut Vec<&'a Link>) {
            for node in nodes {
                if let Some(link) = node.payload::<Link>() {
                    result.push(link);
                    assert!(
                        node.children
                            .iter()
                            .all(|child| child.payload::<Link>().is_none())
                    );
                }
                links(&node.children, result);
            }
        }
        let mut found = Vec::new();
        links(&document.children, &mut found);
        assert_eq!(found.len(), 1, "{source}");
        assert_eq!(found[0].destination, destination, "{source}");
    }
    for source in [
        "`https://trap.jp`",
        "https\\://trap.jp",
        "xhttps://trap.jp",
        "https://",
        "https://trap.jp:65536",
        "https://trap.jp:3000abc",
        "https://trap..jp",
        "https://trap.jp.-invalid",
        "https&#58;//trap.jp",
    ] {
        assert!(
            parser
                .parse_inline(source)
                .unwrap()
                .children
                .iter()
                .all(|node| node.payload::<Link>().is_none()),
            "{source}"
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
fn a_long_url_containing_scheme_tokens_stays_one_link_with_linear_work() {
    let source = format!(
        "[https://trap.jp/?next={}END]",
        "https://trap.jp/".repeat(1_000)
    );
    let document = parser()
        .with_limits(markdown_parser::Limits {
            work: source.len() * 32,
            ..markdown_parser::Limits::default()
        })
        .parse_inline(&source)
        .unwrap();
    let links: Vec<_> = document
        .children
        .iter()
        .filter_map(|node| node.payload::<Link>())
        .collect();
    assert_eq!(links.len(), 1);
    assert!(links[0].destination.ends_with("END"));
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
