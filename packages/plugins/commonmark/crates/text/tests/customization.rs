use markdown_ast::{MutableDocument, Node, Span};
use markdown_commonmark_contracts::{Link, LinkForm, Text};
use markdown_renderer::{Plugin, PresetBuilder, Renderer};

fn renderer(plugin: &Plugin) -> Renderer {
    let mut builder = PresetBuilder::new();
    builder.add(plugin).unwrap();
    Renderer::new(&builder.build().unwrap())
}

#[test]
fn factories_share_identity_and_customization_keeps_defaults_intact() {
    let mut builder = PresetBuilder::new();

    builder.add(&markdown_commonmark_text::plugin()).unwrap();
    assert!(builder.add(&markdown_commonmark_text::plugin()).is_err());
    // Factory calls require no caller clone and return the same default snapshot.
    builder
        .remove(
            &builder
                .registration(&markdown_commonmark_text::plugin())
                .unwrap(),
        )
        .unwrap();

    let default = renderer(&markdown_commonmark_text::plugin());
    let configured = renderer(&markdown_commonmark_text::plugin_with_options(
        markdown_commonmark_text::Options {
            explicit_links: markdown_commonmark_text::ExplicitLinkStyle::LabelAndDestination,
        },
    ));

    let mut custom = markdown_commonmark_text::plugin();
    custom
        .replace::<Link>(|link, _, _, output| output.push(&link.destination))
        .unwrap();

    let document = MutableDocument {
        source: String::new(),
        children: vec![Node::new(
            Span { start: 0, end: 0 },
            Link {
                destination: "https://example.test".into(),
                title: None,
                form: LinkForm::Explicit,
            },
            vec![Node::leaf(
                Span { start: 0, end: 0 },
                Text {
                    value: "label".into(),
                },
            )],
        )],
    };

    assert_eq!(
        renderer(&custom)
            .render(&document)
            .map_err(|error| error.code())
            .unwrap(),
        "https://example.test"
    );

    assert_eq!(
        default
            .render(&document)
            .map_err(|error| error.code())
            .unwrap(),
        "label"
    );
    assert_eq!(
        configured
            .render(&document)
            .map_err(|error| error.code())
            .unwrap(),
        "[label](https://example.test)"
    );

    assert_eq!(
        renderer(&markdown_commonmark_text::plugin())
            .render(&document)
            .map_err(|error| error.code())
            .unwrap(),
        "label"
    );
}
