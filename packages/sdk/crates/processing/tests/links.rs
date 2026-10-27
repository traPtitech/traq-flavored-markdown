use markdown_renderer::Renderer;
use traq_markdown_processing::presets::traq::{embedding, message, plain_text};

const ID: &str = "00000000-0000-0000-0000-000000000001";

#[test]
fn targets_are_independent_of_display_policy() {
    let origin = "https://q.example.test";
    let renderer = plain_text::preset(origin)
        .map(|p| Renderer::new(&p))
        .unwrap();
    let parser = traq_markdown_grammar::presets::traq::v1::parser();
    for (path, label) in [
        ("files", "[添付ファイル]"),
        ("messages", "[引用メッセージ]"),
    ] {
        let url = format!("{origin}/{path}/{ID}");
        let raw = parser.parse(&url).unwrap();
        assert_eq!(flatten(&renderer.render(&raw).unwrap()), url);
        let angle = parser.parse(&format!("<{url}>")).unwrap();
        assert_eq!(flatten(&renderer.render(&angle).unwrap()), label);
        let explicit = parser.parse(&format!("[資料]({url})")).unwrap();
        assert_eq!(
            flatten(&renderer.render(&explicit).unwrap()),
            format!("[資料]({url})")
        );
        let code = parser.parse(&format!("`{url}`")).unwrap();
        assert_eq!(flatten(&renderer.render(&code).unwrap()), url);
    }
}

#[test]
fn message_extraction_and_rendering_share_resource_labels() {
    let origin = "https://q.example.test";
    let parser = traq_markdown_grammar::presets::traq::v1::parser();
    let extractor = message::Extractor::new(origin).unwrap();
    let renderer = Renderer::new(&plain_text::preset(origin).unwrap());

    for (path, kind, label) in [
        ("files", "file", "[添付ファイル]"),
        ("messages", "message", "[引用メッセージ]"),
    ] {
        let url = format!("{origin}/{path}/{ID}");
        let embedding = format!(r#"!{{"type":"{kind}","id":"{ID}"}}"#);

        for source in [format!("<{url}>"), embedding] {
            let document = parser.parse(&source).unwrap();
            let message_text = if source.starts_with('<') {
                format!("<{label}>")
            } else {
                label.into()
            };
            assert_eq!(
                extractor.extract(&document).unwrap().source_text,
                message_text
            );
            assert_eq!(flatten(&renderer.render(&document).unwrap()), label);
        }
    }
}

fn flatten(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[test]
fn bare_urls_are_not_reference_embedding_candidates_even_across_formatting() {
    let parser = traq_markdown_grammar::presets::traq::v1::parser();
    for source in [
        "https://example.com#a",
        "example.com/#a",
        "example.com/hello#a",
        "https://example.com/@alice",
        "example.com/users/@alice/hello",
        "//example.com/@alice",
        "**https://example.com/**@alice**",
        ">https://example.com/@alice",
        "==example.com/@alice==",
        "接続先https://example.com/@alice",
    ] {
        let document = parser.parse_inline(source).unwrap();
        assert!(
            embedding::plan(&document).unwrap().candidates.is_empty(),
            "{source}"
        );
    }
    let source = "https://example.com/#a @alice #a";
    let document = parser.parse_inline(source).unwrap();
    let plan = embedding::plan(&document).unwrap();
    assert_eq!(plan.candidates.len(), 3);
    assert!(
        plan.candidates
            .iter()
            .all(|candidate| candidate.start >= 22)
    );
}
