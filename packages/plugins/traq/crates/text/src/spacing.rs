use markdown_renderer::RenderPlugin;
use markdown_renderer::Result;
use markdown_traq_contracts::BlankLine;

use std::sync::LazyLock;

pub fn plugin() -> RenderPlugin {
    static PLUGIN: LazyLock<RenderPlugin> =
        LazyLock::new(|| build().expect("valid spacing text plugin"));
    PLUGIN.clone()
}

fn build() -> Result<RenderPlugin> {
    let mut spacing = RenderPlugin::new(&markdown_traq_contracts::declarations().spacing);
    spacing.on::<BlankLine>(|_, _, _, output| output.push("\n"))?;
    Ok(spacing)
}
