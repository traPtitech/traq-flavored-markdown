use markdown_generic_contracts::*;
use markdown_renderer::{Plugin, Result};
use std::sync::LazyLock;

pub fn plugin() -> Plugin {
    static PLUGIN: LazyLock<Plugin> = LazyLock::new(|| build().expect("valid mark text plugin"));
    PLUGIN.clone()
}

fn build() -> Result<Plugin> {
    let mut mark = Plugin::new(&markdown_generic_contracts::declarations().mark);
    mark.transparent::<Mark>()?;
    Ok(mark)
}
