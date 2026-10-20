use markdown_commonmark_contracts::{Image, Link, LinkForm};
use markdown_parser::Node;
use traq_markdown_grammar::presets;

#[test]
fn direct_and_reference_images_share_the_same_node_contract() {
    let parser = presets::traq::v1::parser();
    for source in [
        "![alt](https://trap.jp/a.png)",
        "![alt](https://example.com/a.png)",
        "![alt][image]\n\n[image]: https://example.com/a.png",
    ] {
        let document = parser.parse(source).unwrap();
        let paragraph = &document.children[0];
        assert_eq!(paragraph.children.len(), 1, "{source}");
        let image = paragraph.children[0].get::<Image>().unwrap();
        assert_eq!(image.label_source, "alt");
        assert!(image.destination.ends_with("/a.png"));
    }
}

#[test]
fn links_cannot_contain_other_links() {
    fn assert_no_nested_links(nodes: &[Node], inside_link: bool) {
        for node in nodes {
            let is_link = node.get::<Link>().is_some();
            assert!(!(inside_link && is_link), "{node:?}");
            assert_no_nested_links(&node.children, inside_link || is_link);
        }
    }

    let parser = presets::traq::v1::parser();
    for source in [
        "[<https://inner.example>](https://outer.example)",
        "[<a@example.com>](https://outer.example)",
        "[outer [inner](/inner)](/outer)",
    ] {
        let document = parser.parse_inline(source).unwrap();
        assert_no_nested_links(&document.children, false);
        assert!(
            document
                .children
                .iter()
                .any(|node| node.get::<Link>().is_some())
        );
    }
}

#[test]
fn images_remain_valid_inside_links_and_can_contain_autolink_labels() {
    let parser = presets::traq::v1::parser();
    let document = parser.parse_inline("[![alt](/image)](/page)").unwrap();
    let link = &document.children[0];
    assert_eq!(link.get::<Link>().unwrap().destination, "/page");
    assert!(link.children[0].get::<Image>().is_some());

    let document = parser
        .parse_inline("![<https://example.com>](/image)")
        .unwrap();
    let image = &document.children[0];
    assert!(image.get::<Image>().is_some());
    assert_eq!(
        image.children[0].get::<Link>().unwrap().form,
        LinkForm::Autolink
    );
}

#[test]
fn destination_syntax_is_independent_of_rendering_policy() {
    let parser = presets::traq::v1::parser();
    for destination in [
        "javascript:alert",
        "vbscript:alert",
        "file:///a",
        "data:text/plain,hello",
        "data:image/png;base64,AA==",
    ] {
        for source in [
            format!("[x]({destination})"),
            format!("<{}>", destination),
            format!("[x][r]\n\n[r]: {destination}"),
        ] {
            let document = parser.parse(&source).unwrap();
            let link = document.children[0].children[0].get::<Link>().unwrap();
            assert_eq!(link.destination, destination, "{source}");
        }

        let document = parser
            .parse_inline(&format!("![x]({destination})"))
            .unwrap();
        assert_eq!(
            document.children[0].get::<Image>().unwrap().destination,
            destination
        );
    }
}

#[test]
fn destinations_are_encoded_without_losing_source_notation() {
    let parser = presets::traq::v1::parser();
    for source in [
        "[x](<https://example.com/日本>)",
        "<https://example.com/日本>",
        "https://example.com/日本",
    ] {
        let document = parser.parse_inline(source).unwrap();
        assert_eq!(document.source, source);
        assert_eq!(
            document.children[0].get::<Link>().unwrap().destination,
            "https://example.com/%E6%97%A5%E6%9C%AC"
        );
    }
}
