use traq_markdown_grammar::{Parser, presets, syntax::extensions::math};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let source = "**hello** :stamp: $x$";
    let parser = presets::traq::v1::parser();
    println!("{:#?}", parser.parse(source)?);

    let mut builder = presets::traq::v1::grammar().to_builder();
    builder.remove(math::plugin())?;

    let grammar = builder.build()?;
    let without_math = Parser::new(&grammar);
    drop(grammar);
    println!("{:#?}", without_math.parse_inline("$x$")?);

    let extractor = traq_markdown_processing::extraction::Extractor::new(
        traq_markdown_processing::extraction::ExtractorOptions {
            origin: "https://q.example.test".into(),
        },
    )?;

    println!(
        "{:#?}",
        extractor.extract(&parser.parse("**hello** !!secret!!")?)?
    );

    let renderer = traq_markdown_processing::rendering::PlainTextRenderer::new(
        traq_markdown_processing::rendering::RendererOptions::default(),
    )?;

    let document = parser.parse("**hello** !!secret!!")?;
    println!("{}", renderer.render(&document)?);

    Ok(())
}
