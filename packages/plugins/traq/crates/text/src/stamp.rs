use markdown_renderer::RenderPlugin;
use markdown_renderer::Result;
use markdown_traq_contracts::Stamp;

use std::sync::LazyLock;

pub fn plugin() -> RenderPlugin {
    static PLUGIN: LazyLock<RenderPlugin> =
        LazyLock::new(|| build().expect("valid stamp text plugin"));
    PLUGIN.clone()
}

fn build() -> Result<RenderPlugin> {
    let mut stamp = RenderPlugin::new(&markdown_traq_contracts::declarations().stamp);
    stamp.on::<Stamp>(|v, _, _, output| output.push(&v.literal))?;
    Ok(stamp)
}
