use markdown_commonmark_contracts::Link;
use markdown_parser::{GrammarBuilder, Parser};

fn parser(tld_pattern: &str) -> Parser {
    let commonmark = markdown_commonmark::Syntax::new();
    let linkify = markdown_extensions_syntax::linkify::Syntax::new(tld_pattern).unwrap();
    let mut builder = GrammarBuilder::new();
    builder.add(&commonmark.plugin).unwrap();
    builder.add(&linkify.plugin).unwrap();
    Parser::new(&builder.build().unwrap())
}

#[test]
fn top_level_domain_policy_belongs_to_the_selected_profile() {
    let private = parser("internal");
    let public = parser("com");
    for (parser, expected) in [
        (&private, "http://host.internal"),
        (&public, "http://host.com"),
    ] {
        let document = parser.parse_inline("host.internal host.com").unwrap();
        let links: Vec<_> = document
            .children
            .iter()
            .filter_map(|node| node.get::<Link>())
            .collect();
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].destination, expected);
    }
    assert!(markdown_extensions_syntax::linkify::Syntax::new("[").is_err());
}
