use markdown_ast::Node;
use markdown_generic_contracts::*;
use markdown_renderer::{Context, Plugin, Result};
use std::sync::LazyLock;

fn children<T>(_: &T, nodes: &[Node], ctx: &Context<'_>) -> Result<String> {
    ctx.children(nodes)
}

pub fn plugin() -> Plugin {
    static PLUGIN: LazyLock<Plugin> = LazyLock::new(|| build().expect("valid table text plugin"));
    PLUGIN.clone()
}

fn build() -> Result<Plugin> {
    let mut table = Plugin::new(&markdown_generic_contracts::preset().table);

    table.on::<TableData>(children)?;
    table.on::<CellData>(children)?;

    table.on::<RowData>(|_, nodes, ctx| {
        let mut output = String::new();
        for (i, node) in nodes.iter().enumerate() {
            if i > 0 {
                ctx.append(&mut output, " | ")?;
            }
            ctx.append(&mut output, &ctx.children(std::slice::from_ref(node))?)?;
        }
        ctx.append(&mut output, "\n")?;
        Ok(output)
    })?;

    Ok(table)
}
