use markdown_renderer::{Plugin, Result};
use markdown_trap_contracts::BlankLineData;

use std::sync::LazyLock;

pub fn plugin() -> Plugin {
    static PLUGIN: LazyLock<Plugin> = LazyLock::new(|| build().expect("valid compat text plugin"));
    PLUGIN.clone()
}

fn build() -> Result<Plugin> {
    let mut compat = Plugin::new(&markdown_trap_contracts::preset().compat);
    compat.on::<BlankLineData>(|_, _, _| Ok("\n".into()))?;
    Ok(compat)
}
