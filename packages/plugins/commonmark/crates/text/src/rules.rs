use crate::Options;
use markdown_ast::Node;
use markdown_commonmark_contracts::*;
use markdown_renderer::Context;
use markdown_renderer::Output;
use markdown_renderer::RenderPlugin;
use markdown_renderer::Result;

fn block<T>(_: &T, nodes: &[Node], ctx: &Context<'_>, output: &mut Output<'_>) -> Result<()> {
    ctx.children(nodes, output)?;
    output.push("\n")
}

pub(crate) fn register(renderer: &mut RenderPlugin, options: Options) -> Result<()> {
    renderer.on::<Text>(|v, _, _, output| output.push(&v.value))?;
    renderer.on::<Paragraph>(block)?;
    renderer.on::<Heading>(block)?;
    renderer.on::<Blockquote>(block)?;
    renderer.transparent::<Emphasis>()?;
    renderer.transparent::<Strong>()?;
    renderer.transparent::<Image>()?;
    renderer.transparent::<ListItem>()?;
    renderer.on::<Softbreak>(|_, _, _, output| output.push("\n"))?;
    renderer.on::<Hardbreak>(|_, _, _, output| output.push("\n"))?;
    renderer.on::<ThematicBreak>(|_, _, _, output| output.push("\n"))?;

    renderer.on::<InlineCode>(|v, _, _, output| output.push(&v.literal))?;

    renderer.on::<CodeBlock>(|v, _, _, output| {
        output.push(&v.literal)?;
        output.push("\n")
    })?;

    renderer.on::<Link>(move |link, nodes, context, output| {
        options.explicit_links.render(link, nodes, context, output)
    })?;

    renderer.on::<List>(|list, nodes, ctx, output| {
        for (index, node) in nodes.iter().enumerate() {
            let marker = match list.kind {
                ListKind::Ordered { start, .. } => format!("{}.", u64::from(start) + index as u64),
                ListKind::Bullet { .. } => "•".into(),
            };
            let text = ctx.capture_children(std::slice::from_ref(node))?;
            output.push(&marker)?;
            output.push(" ")?;
            output.push(text.trim())?;
            output.push("\n")?;
        }
        Ok(())
    })
}
