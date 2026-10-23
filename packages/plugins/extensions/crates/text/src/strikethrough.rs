use markdown_extensions_contracts::*;
use markdown_renderer::RenderPlugin;
use markdown_renderer::Result;
use std::sync::LazyLock;

pub fn plugin() -> RenderPlugin {
    static PLUGIN: LazyLock<RenderPlugin> =
        LazyLock::new(|| build().expect("valid strikethrough text plugin"));
    PLUGIN.clone()
}

fn build() -> Result<RenderPlugin> {
    let mut strikethrough =
        RenderPlugin::new(&markdown_extensions_contracts::declarations().strikethrough);
    strikethrough.transparent::<Strikethrough>()?;
    Ok(strikethrough)
}
