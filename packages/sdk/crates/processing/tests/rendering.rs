use traq_markdown_grammar::bindings;
use traq_markdown_processing::rendering::{PlainTextRenderer, RendererOptions};

#[test]
fn plain_text_renderer_preserves_all_notification_fixtures() {
    let parser = bindings::parser("traq.v1").unwrap();
    let renderer = PlainTextRenderer::new(RendererOptions {
        origin: "https://q.example.test".into(),
    })
    .unwrap();
    let fixtures: Vec<serde_json::Value> = serde_json::from_str(include_str!(
        "../../../tests/fixtures/processing-notifications.json"
    ))
    .unwrap();
    assert_eq!(fixtures.len(), 787);
    for fixture in fixtures {
        let document = parser.parse(fixture["source"].as_str().unwrap()).unwrap();
        assert_eq!(
            renderer.render(&document).unwrap(),
            fixture["notification"].as_str().unwrap(),
            "{}",
            fixture["name"]
        );
    }
}

#[test]
fn rendering_depends_on_the_supplied_ast_not_a_grammar_version() {
    let renderer = PlainTextRenderer::new(RendererOptions::default()).unwrap();
    for version in ["commonmark", "traq.v1", "commonmark"] {
        let document = bindings::parser(version)
            .unwrap()
            .parse("!!secret!!")
            .unwrap();
        let expected = if version == "commonmark" {
            "!!secret!!"
        } else {
            "██████"
        };
        assert_eq!(renderer.render(&document).unwrap(), expected);
        assert_eq!(document.source, "!!secret!!");
    }
}
