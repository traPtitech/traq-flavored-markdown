use markdown_extensions_contracts::*;
use markdown_renderer::RenderPlugin;
use markdown_renderer::Result;
use std::sync::LazyLock;

pub fn plugin() -> RenderPlugin {
    static PLUGIN: LazyLock<RenderPlugin> =
        LazyLock::new(|| build().expect("valid mark text plugin"));
    PLUGIN.clone()
}

fn build() -> Result<RenderPlugin> {
    let mut mark = RenderPlugin::new(&markdown_extensions_contracts::declarations().mark);
    mark.transparent::<Mark>()?;
    Ok(mark)
}
