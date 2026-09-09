use markdown_ast::Node;
use markdown_commonmark_contracts::*;
use markdown_renderer::{Context, Plugin, Result};

fn children<T>(_: &T, nodes: &[Node], ctx: &Context<'_>) -> Result<String> {
    ctx.children(nodes)
}

fn block<T>(_: &T, nodes: &[Node], ctx: &Context<'_>) -> Result<String> {
    let mut output = ctx.children(nodes)?;
    ctx.append(&mut output, "\n")?;
    Ok(output)
}

pub(crate) fn register(renderer: &mut Plugin) -> Result<()> {
    renderer.on::<Text>(|v, _, _| Ok(v.value.clone()))?;
    renderer.on::<Paragraph>(block)?;
    renderer.on::<Heading>(block)?;
    renderer.on::<Blockquote>(block)?;
    renderer.on::<Emphasis>(children)?;
    renderer.on::<Strong>(children)?;
    renderer.on::<Image>(children)?;
    renderer.on::<ListItem>(children)?;
    renderer.on::<Softbreak>(|_, _, _| Ok("\n".into()))?;
    renderer.on::<Hardbreak>(|_, _, _| Ok("\n".into()))?;
    renderer.on::<ThematicBreak>(|_, _, _| Ok("\n".into()))?;

    renderer.on::<InlineCode>(|v, _, _| Ok(v.literal.clone()))?;

    renderer.on::<CodeBlock>(|v, _, ctx| {
        let mut text = v.literal.clone();
        ctx.append(&mut text, "\n")?;
        Ok(text)
    })?;

    renderer.on::<Link>(children)?;

    renderer.on::<List>(|list, nodes, ctx| {
        let mut output = String::new();
        for (index, node) in nodes.iter().enumerate() {
            let marker = if list.ordered {
                format!("{}.", u64::from(list.start) + index as u64)
            } else {
                "•".into()
            };
            let text = ctx.children(std::slice::from_ref(node))?;
            ctx.append(&mut output, &marker)?;
            ctx.append(&mut output, " ")?;
            ctx.append(&mut output, text.trim())?;
            ctx.append(&mut output, "\n")?;
        }
        Ok(output)
    })
}
