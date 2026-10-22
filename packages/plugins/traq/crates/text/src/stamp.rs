use markdown_renderer::{Plugin, Result};
use markdown_trap_contracts::Stamp;

use std::sync::LazyLock;

pub fn plugin() -> Plugin {
    static PLUGIN: LazyLock<Plugin> = LazyLock::new(|| build().expect("valid stamp text plugin"));
    PLUGIN.clone()
}

fn build() -> Result<Plugin> {
    let mut stamp = Plugin::new(&markdown_trap_contracts::declarations().stamp);
    stamp.on::<Stamp>(|v, _, _, output| output.push(&v.literal))?;
    Ok(stamp)
}
