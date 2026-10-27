#[path = "../abi.rs"]
#[allow(
    dead_code,
    reason = "The native exporter shares ABI declarations without calling runtime error helpers"
)]
mod abi;
#[path = "../limits.rs"]
mod limits;
#[path = "../node_catalog.rs"]
mod node_catalog;
#[path = "../node_metadata.rs"]
mod node_metadata;
#[path = "../nodes.rs"]
mod nodes;

#[cfg(test)]
#[path = "../node_contract_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "../compatibility_tests.rs"]
mod compatibility_tests;

use traq_markdown_processing::extraction::{Extraction, ExtractorOptions};
use traq_markdown_processing::pipeline::{ProcessingResult, ProcessorOptions};
use traq_markdown_processing::rendering::PlainTextOptions;

fn main() -> markdown_contract_export::Result<()> {
    use markdown_contract_export::{ArtifactContract, Direction, Provenance, schema, write};
    use schemars::generate::Contract;
    use std::collections::BTreeMap;
    let directory = std::env::args().nth(1).ok_or("Pass the output directory")?;
    // Check that metadata and codec registrations agree before writing bindings.
    let _ = nodes::codec();
    let manifest = ArtifactContract {
        contract_id: abi::CONTRACT_ID.into(),
        provenance: Provenance {
            source_fingerprint: env!("MARKDOWN_SOURCE_FINGERPRINT").into(),
        },
        abi: abi::descriptor()?,
        directions: BTreeMap::from([
            ("ExtractorOptions".into(), Direction::Request),
            ("PlainTextOptions".into(), Direction::Request),
            ("Extraction".into(), Direction::Response),
            ("ProcessorOptions".into(), Direction::Request),
            ("ProcessorConfiguration".into(), Direction::Request),
            ("ProcessingResult".into(), Direction::Response),
        ]),
        processing: BTreeMap::from([
            (
                "ExtractorOptions".into(),
                schema::<ExtractorOptions>(Contract::Deserialize),
            ),
            (
                "PlainTextOptions".into(),
                schema::<PlainTextOptions>(Contract::Deserialize),
            ),
            (
                "Extraction".into(),
                schema::<Extraction>(Contract::Serialize),
            ),
            (
                "ProcessorOptions".into(),
                schema::<ProcessorOptions>(Contract::Deserialize),
            ),
            (
                "ProcessorConfiguration".into(),
                schema::<abi::ProcessorConfiguration>(Contract::Deserialize),
            ),
            (
                "ProcessingResult".into(),
                schema::<ProcessingResult>(Contract::Serialize),
            ),
        ]),
        presets: traq_markdown_grammar::bindings::preset_exports()
            .into_iter()
            .map(|(name, entry)| Ok((name, preset_entry(entry)?)))
            .collect::<Result<_, Box<dyn std::error::Error>>>()?,
        limits: limits::metadata().into(),
        nodes: node_metadata::export()?.nodes,
    };
    write(directory, &manifest)
}

fn preset_entry(
    entry: traq_markdown_grammar::bindings::ExportEntry<traq_markdown_grammar::bindings::PresetId>,
) -> Result<markdown_contract_export::PresetEntry, Box<dyn std::error::Error>> {
    use traq_markdown_grammar::bindings::ExportEntry;
    Ok(match entry {
        ExportEntry::Id(id) => markdown_contract_export::PresetEntry::Id(id.0.try_into()?),
        ExportEntry::Group(group) => markdown_contract_export::PresetEntry::Group(
            group
                .into_iter()
                .map(|(name, entry)| Ok((name, preset_entry(entry)?)))
                .collect::<Result<_, Box<dyn std::error::Error>>>()?,
        ),
    })
}
