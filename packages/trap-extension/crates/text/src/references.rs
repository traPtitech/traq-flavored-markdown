use markdown_renderer::{Plugin, Result};
use markdown_trap_contracts::{EmbeddingData, ReferenceData};

use std::sync::LazyLock;

pub fn plugin() -> Plugin {
    static PLUGIN: LazyLock<Plugin> =
        LazyLock::new(|| build().expect("valid references text plugin"));
    PLUGIN.clone()
}

fn build() -> Result<Plugin> {
    let mut references = Plugin::new(&markdown_trap_contracts::preset().references);

    references.on::<ReferenceData>(|v, _, _| Ok(v.label.clone()))?;

    // Attachment presentation is selected by the product preset.
    references.on::<EmbeddingData>(|v, _, _| Ok(v.literal.clone()))?;

    Ok(references)
}
