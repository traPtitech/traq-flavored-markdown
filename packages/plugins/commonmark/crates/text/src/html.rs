use markdown_commonmark_contracts::{HtmlBlock, HtmlInline};
use markdown_renderer::{Plugin, Result};
use std::sync::LazyLock;

pub fn plugin() -> Plugin {
    static PLUGIN: LazyLock<Plugin> = LazyLock::new(|| build().expect("valid HTML text plugin"));
    PLUGIN.clone()
}

fn build() -> Result<Plugin> {
    let mut renderer = Plugin::new(&markdown_commonmark_contracts::declarations().html);
    renderer.on::<HtmlInline>(|v, _, _, output| output.push(&v.literal))?;

    renderer.on::<HtmlBlock>(|v, _, _, output| {
        output.push(&v.literal)?;
        output.push("\n")
    })?;

    Ok(renderer)
}
