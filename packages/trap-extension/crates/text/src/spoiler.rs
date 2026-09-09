use markdown_renderer::{Plugin, Result};
use markdown_trap_contracts::SpoilerData;

use std::sync::LazyLock;

pub fn plugin() -> Plugin {
    static PLUGIN: LazyLock<Plugin> = LazyLock::new(|| build().expect("valid spoiler text plugin"));
    PLUGIN.clone()
}

fn build() -> Result<Plugin> {
    let mut spoiler = Plugin::new(&markdown_trap_contracts::preset().spoiler);

    spoiler.on::<SpoilerData>(|_, nodes, ctx| {
        let content = ctx.children(nodes)?;
        let mut output = String::new();

        for ch in content.chars() {
            ctx.append(
                &mut output,
                match ch {
                    '\r' => "\r",
                    '\n' => "\n",
                    _ => "█",
                },
            )?;
        }

        Ok(output)
    })?;

    Ok(spoiler)
}
