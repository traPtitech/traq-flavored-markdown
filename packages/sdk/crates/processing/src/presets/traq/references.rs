//! Collect references in document order, including duplicates and spoilers.
use crate::References;
use markdown_extractor::ExtractionPreset;
use markdown_extractor::ExtractionPresetBuilder;
use markdown_extractor::Result;

pub fn builder() -> Result<ExtractionPresetBuilder<References>> {
    let mut builder = ExtractionPresetBuilder::new();
    builder.add(&markdown_trap_extraction::references::plugin())?;
    Ok(builder)
}

pub fn preset() -> Result<ExtractionPreset<References>> {
    builder()?.build()
}
