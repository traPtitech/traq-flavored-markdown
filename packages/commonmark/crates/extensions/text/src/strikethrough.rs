use markdown_ast::Node;
use markdown_generic_contracts::*;
use markdown_renderer::{Context, Plugin, Result};
use std::sync::LazyLock;

fn children<T>(_: &T, nodes: &[Node], ctx: &Context<'_>) -> Result<String> {
    ctx.children(nodes)
}

pub fn plugin() -> Plugin {
    static PLUGIN: LazyLock<Plugin> =
        LazyLock::new(|| build().expect("valid strikethrough text plugin"));
    PLUGIN.clone()
}

fn build() -> Result<Plugin> {
    let mut strikethrough = Plugin::new(&markdown_generic_contracts::preset().strikethrough);
    strikethrough.on::<StrikethroughData>(children)?;
    Ok(strikethrough)
}
