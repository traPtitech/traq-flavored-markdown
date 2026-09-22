use markdown_renderer::Renderer;
use traq_markdown_processing::presets::traq::{message, plain_text};

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
        assert_eq!(flatten(&renderer.render(&raw).unwrap()), label);
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
    let extractor = message::Extractor::new(origin);
    let renderer = Renderer::new(&plain_text::preset(origin).unwrap());

    for (path, kind, label) in [
        ("files", "file", "[添付ファイル]"),
        ("messages", "message", "[引用メッセージ]"),
    ] {
        let url = format!("{origin}/{path}/{ID}");
        let embedding = format!(r#"!{{"type":"{kind}","id":"{ID}"}}"#);

        for source in [url, embedding] {
            let document = parser.parse(&source).unwrap();
            assert_eq!(extractor.extract(&document).unwrap().plain_text, label);
            assert_eq!(flatten(&renderer.render(&document).unwrap()), label);
        }
    }
}

fn flatten(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}
