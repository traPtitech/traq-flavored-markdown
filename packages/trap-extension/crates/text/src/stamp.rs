use markdown_renderer::{Plugin, Result};
use markdown_trap_contracts::StampData;

use std::sync::LazyLock;

pub fn plugin() -> Plugin {
    static PLUGIN: LazyLock<Plugin> = LazyLock::new(|| build().expect("valid stamp text plugin"));
    PLUGIN.clone()
}

fn build() -> Result<Plugin> {
    let mut stamp = Plugin::new(&markdown_trap_contracts::preset().stamp);
    stamp.on::<StampData>(|v, _, _| Ok(v.literal.clone()))?;
    Ok(stamp)
}
