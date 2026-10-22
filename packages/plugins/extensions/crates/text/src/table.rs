use markdown_ast::Node;
use markdown_extensions_contracts::*;
use markdown_renderer::{Context, Output, Plugin, Result};
use std::sync::LazyLock;

fn row<T>(_: &T, nodes: &[Node], ctx: &Context<'_>, output: &mut Output<'_>) -> Result<()> {
    for (index, node) in nodes.iter().enumerate() {
        if index > 0 {
            output.push(" | ")?;
        }
        ctx.node(node, output)?;
    }
    output.push("\n")
}

pub fn plugin() -> Plugin {
    static PLUGIN: LazyLock<Plugin> = LazyLock::new(|| build().expect("valid table text plugin"));
    PLUGIN.clone()
}

fn build() -> Result<Plugin> {
    let mut table = Plugin::new(&markdown_extensions_contracts::declarations().table);

    table.transparent::<Table>()?;
    table.transparent::<Cell>()?;

    table.on::<HeaderRow>(row)?;
    table.on::<Row>(row)?;

    Ok(table)
}
