use markdown_renderer::RenderPresetBuilder;
use markdown_renderer::Renderer;
use markdown_trap_contracts::Spoiler;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut builder = RenderPresetBuilder::new();
    for plugin in [
        markdown_commonmark_text::plugin(),
        markdown_commonmark_text::html::plugin(),
        markdown_extensions_text::math::plugin(),
        markdown_extensions_text::table::plugin(),
        markdown_extensions_text::mark::plugin(),
        markdown_extensions_text::strikethrough::plugin(),
        markdown_trap_text::references::plugin(),
        markdown_trap_text::stamp::plugin(),
        markdown_trap_text::spoiler::plugin(),
        markdown_trap_text::spacing::plugin(),
    ] {
        builder.add(&plugin)?;
    }
    let original = Renderer::new(&builder.clone().build()?);

    // Customize one type while keeping the original renderer valid.
    let mut spoiler = markdown_trap_text::spoiler::plugin();
    let registration = builder.registration(&spoiler).expect("preset spoiler");
    builder.remove(&registration)?;
    spoiler.replace::<Spoiler>(|_, _, _, output| output.push("[非表示]"))?;
    builder.add(&spoiler)?;
    let customized = Renderer::new(&builder.build()?);

    let parser = traq_markdown_grammar::presets::traq::v1::parser();
    let document = parser.parse("**こんにちは** !!秘密!! :stamp:")?;
    let original = original.render(&document).map_err(|error| error.code())?;
    let customized = customized.render(&document).map_err(|error| error.code())?;
    assert_eq!(original.trim(), "こんにちは ██ :stamp:");
    assert_eq!(customized.trim(), "こんにちは [非表示] :stamp:");
    println!("{original}{customized}");
    Ok(())
}
