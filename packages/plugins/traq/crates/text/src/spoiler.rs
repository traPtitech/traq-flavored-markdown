use markdown_renderer::{Plugin, Result};
use markdown_trap_contracts::Spoiler;

use std::sync::LazyLock;

pub fn plugin() -> Plugin {
    static PLUGIN: LazyLock<Plugin> = LazyLock::new(|| build().expect("valid spoiler text plugin"));
    PLUGIN.clone()
}

fn build() -> Result<Plugin> {
    let mut spoiler = Plugin::new(&markdown_trap_contracts::declarations().spoiler);

    spoiler.on::<Spoiler>(|_, nodes, ctx, output| {
        let content = ctx.capture_children(nodes)?;

        for ch in content.chars() {
            output.push(match ch {
                '\r' => "\r",
                '\n' => "\n",
                _ => "█",
            })?;
        }

        Ok(())
    })?;

    Ok(spoiler)
}
