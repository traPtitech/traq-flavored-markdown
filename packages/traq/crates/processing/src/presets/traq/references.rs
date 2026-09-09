//! Collect references in document order, including duplicates and spoilers.
use crate::References;
use markdown_extractor::{Preset, PresetBuilder, Result};

pub fn builder() -> Result<PresetBuilder<References>> {
    let mut builder = PresetBuilder::new();
    builder.add(&markdown_trap_extraction::references::plugin())?;
    Ok(builder)
}

pub fn preset() -> Result<Preset<References>> {
    builder()?.build()
}
