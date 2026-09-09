use markdown_extractor::Extractor;
use markdown_renderer::Renderer;
use traq_markdown_processing::presets::traq;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let parser = traq_markdown_grammar::presets::traq::v1::parser();
    let renderer = Renderer::new(&traq::notification::preset("https://q.example.test")?);
    let extractor = Extractor::new(&traq::references::preset()?);

    let source = r#"**こんにちは** !!秘密!! !{"type":"user","id":"00000000-0000-0000-0000-000000000001","raw":"@alice"}"#;
    let document = parser.parse(source)?;
    // Both consumers borrow the same native AST; there is no AST JSON roundtrip.
    let text = renderer.render(&document)?;
    let references = extractor.extract(&document)?;
    // Single-line formatting is an application decision, after rendering blocks.
    let notification = text.split_whitespace().collect::<Vec<_>>().join(" ");
    println!(
        "{}",
        serde_json::json!({"notificationText":notification,"references":references})
    );
    Ok(())
}
