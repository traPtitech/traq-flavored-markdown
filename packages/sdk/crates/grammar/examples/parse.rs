use markdown_commonmark_contracts::Text;
use traq_markdown_grammar::{Node, Parser, presets, syntax::extensions};

fn print_text(nodes: &[Node]) {
    for node in nodes {
        if let Some(text) = node.get::<Text>() {
            println!("{}..{}: {}", node.span.start, node.span.end, text.value);
        }
        print_text(&node.children);
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let parser = presets::traq::v1::parser();
    for source in ["**hello** :stamp:", "another message"] {
        let document = parser.parse(source)?;
        print_text(&document.children);
    }

    let mut builder = presets::traq::v1::builder();
    builder.remove(extensions::math::plugin())?;
    let customized = Parser::new(&builder.build()?);
    let document = customized.parse_inline("$literal without math$")?;
    print_text(&document.children);
    Ok(())
}
