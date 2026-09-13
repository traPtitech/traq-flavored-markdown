use markdown_renderer::{PresetBuilder, Renderer};
use markdown_trap_contracts::SpoilerData;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut builder = PresetBuilder::new();
    for plugin in [
        markdown_commonmark_text::plugin(),
        markdown_commonmark_text::html::plugin(),
        markdown_generic_text::math::plugin(),
        markdown_generic_text::table::plugin(),
        markdown_generic_text::mark::plugin(),
        markdown_generic_text::strikethrough::plugin(),
        markdown_trap_text::references::plugin(),
        markdown_trap_text::stamp::plugin(),
        markdown_trap_text::spoiler::plugin(),
        markdown_trap_text::compat::plugin(),
    ] {
        builder.add(&plugin)?;
    }
    let original = Renderer::new(&builder.clone().build()?);

    // Customize one type while keeping the original renderer valid.
    let mut spoiler = markdown_trap_text::spoiler::plugin();
    builder.remove(&spoiler)?;
    spoiler.replace::<SpoilerData>(|_, _, _| Ok("[非表示]".into()))?;
    builder.add(&spoiler)?;
    let customized = Renderer::new(&builder.build()?);

    let parser = traq_markdown_grammar::presets::traq::v1::parser();
    let document = parser.parse("**こんにちは** !!秘密!! :stamp:")?;
    let original = original.render(&document)?;
    let customized = customized.render(&document)?;
    assert_eq!(original.trim(), "こんにちは ██ :stamp:");
    assert_eq!(customized.trim(), "こんにちは [非表示] :stamp:");
    println!("{original}{customized}");
    Ok(())
}
