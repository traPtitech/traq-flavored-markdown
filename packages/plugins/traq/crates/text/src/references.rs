use markdown_renderer::{Plugin, Result};
use markdown_trap_contracts::{Embedding, Reference};

use std::sync::LazyLock;

pub fn plugin() -> Plugin {
    static PLUGIN: LazyLock<Plugin> =
        LazyLock::new(|| build().expect("valid references text plugin"));
    PLUGIN.clone()
}

fn build() -> Result<Plugin> {
    let mut references = Plugin::new(&markdown_trap_contracts::declarations().references);

    references.on::<Reference>(|v, _, _, output| output.push(&v.label))?;

    // Attachment presentation is selected by the product preset.
    references.on::<Embedding>(|v, _, _, output| output.push(&v.literal))?;

    Ok(references)
}
