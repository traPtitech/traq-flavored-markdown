use markdown_commonmark::{Syntax, html};
use markdown_parser::{GrammarBuilder, Parser};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let syntax = Syntax::default();
    let mut builder = GrammarBuilder::new();

    builder.add(&syntax.plugin)?;
    builder.add(html::plugin())?;

    builder.before(html::inline_rule(), &syntax.inline.entity)?;
    builder.before(html::block_rule(), &syntax.block.heading)?;

    let parser = Parser::new(&builder.build()?);

    // Only CommonMark and the generic parser are linked; no traQ distribution.
    let document = parser.parse("# hello\n\n<b>world</b>")?;

    println!("{} top-level nodes", document.children.len());

    Ok(())
}
