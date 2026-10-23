use markdown_commonmark_contracts::{HtmlBlock, HtmlInline};
use markdown_renderer::RenderPlugin;
use markdown_renderer::Result;
use std::sync::LazyLock;

pub fn plugin() -> RenderPlugin {
    static PLUGIN: LazyLock<RenderPlugin> =
        LazyLock::new(|| build().expect("valid HTML text plugin"));
    PLUGIN.clone()
}

fn build() -> Result<RenderPlugin> {
    let mut renderer = RenderPlugin::new(&markdown_commonmark_contracts::declarations().html);
    renderer.on::<HtmlInline>(|v, _, _, output| output.push(&v.literal))?;

    renderer.on::<HtmlBlock>(|v, _, _, output| {
        output.push(&v.literal)?;
        output.push("\n")
    })?;

    Ok(renderer)
}
