use markdown_renderer::{Plugin, Result};
use markdown_trap_contracts::BlankLine;

use std::sync::LazyLock;

pub fn plugin() -> Plugin {
    static PLUGIN: LazyLock<Plugin> = LazyLock::new(|| build().expect("valid spacing text plugin"));
    PLUGIN.clone()
}

fn build() -> Result<Plugin> {
    let mut spacing = Plugin::new(&markdown_trap_contracts::declarations().spacing);
    spacing.on::<BlankLine>(|_, _, _, output| output.push("\n"))?;
    Ok(spacing)
}
