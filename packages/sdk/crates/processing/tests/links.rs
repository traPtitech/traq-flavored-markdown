use markdown_renderer::Renderer;
use traq_markdown_processing::presets::traq::notification;

const ID: &str = "00000000-0000-0000-0000-000000000001";

#[test]
fn targets_are_independent_of_display_policy() {
    let origin = "https://q.example.test";
    let renderer = notification::preset(origin)
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
        assert_eq!(flatten(&renderer.render(&explicit).unwrap()), "資料");
        let code = parser.parse(&format!("`{url}`")).unwrap();
        assert_eq!(flatten(&renderer.render(&code).unwrap()), url);
    }
}

fn flatten(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}
