use markdown_generic_contracts::*;
use markdown_renderer::{Plugin, Result};
use std::sync::LazyLock;

pub fn plugin() -> Plugin {
    static PLUGIN: LazyLock<Plugin> =
        LazyLock::new(|| build().expect("valid strikethrough text plugin"));
    PLUGIN.clone()
}

fn build() -> Result<Plugin> {
    let mut strikethrough = Plugin::new(&markdown_generic_contracts::declarations().strikethrough);
    strikethrough.transparent::<Strikethrough>()?;
    Ok(strikethrough)
}
