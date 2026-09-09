use markdown_commonmark_contracts::{HtmlBlock, HtmlInline};
use markdown_renderer::{Plugin, Result};
use std::sync::LazyLock;

pub fn plugin() -> Plugin {
    static PLUGIN: LazyLock<Plugin> = LazyLock::new(|| build().expect("valid HTML text plugin"));
    PLUGIN.clone()
}

fn build() -> Result<Plugin> {
    let mut renderer = Plugin::new(&markdown_commonmark_contracts::preset().html);
    renderer.on::<HtmlInline>(|v, _, _| Ok(v.literal.clone()))?;

    renderer.on::<HtmlBlock>(|v, _, ctx| {
        let mut text = v.literal.clone();
        ctx.append(&mut text, "\n")?;
        Ok(text)
    })?;

    Ok(renderer)
}
