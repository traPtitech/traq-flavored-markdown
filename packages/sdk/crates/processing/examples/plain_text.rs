use markdown_extractor::Extractor;
use markdown_renderer::Renderer;
use traq_markdown_processing::presets::traq;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let parser = traq_markdown_grammar::presets::traq::v1::parser();
    let renderer = Renderer::new(&traq::plain_text::preset("https://q.example.test")?);
    let extractor = Extractor::new(&traq::references::preset()?);

    let source = r#"**こんにちは** !!秘密!! !{"type":"user","id":"00000000-0000-0000-0000-000000000001","raw":"@alice"}"#;
    let document = parser.parse(source)?;
    // Validate once for both consumers while the AST is immutably borrowed.
    let validated = markdown_ast::ValidatedDocument::new(&document)?;
    let text = renderer.render_validated(validated)?;
    let references = extractor.extract_validated(validated)?;
    // Single-line formatting is an application decision, after rendering blocks.
    let plain_text = text.split_whitespace().collect::<Vec<_>>().join(" ");
    println!(
        "{}",
        serde_json::json!({"plainText":plain_text,"references":references})
    );
    Ok(())
}
