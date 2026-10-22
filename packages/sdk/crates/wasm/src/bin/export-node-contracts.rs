#[macro_use]
#[path = "../node_catalog.rs"]
mod node_catalog;
#[path = "../abi.rs"]
#[allow(dead_code)]
mod abi;
#[path = "../limits.rs"]
mod limits;
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
use traq_markdown_processing::rendering::RendererOptions;

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
            ("RendererOptions".into(), Direction::Request),
            ("Extraction".into(), Direction::Response),
            ("ProcessorOptions".into(), Direction::Request),
            ("ProcessingResult".into(), Direction::Response),
        ]),
        processing: BTreeMap::from([
            (
                "ExtractorOptions".into(),
                schema::<ExtractorOptions>(Contract::Deserialize),
            ),
            (
                "RendererOptions".into(),
                schema::<RendererOptions>(Contract::Deserialize),
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
                "ProcessingResult".into(),
                schema::<ProcessingResult>(Contract::Serialize),
            ),
        ]),
        parse_error: schema::<traq_markdown_grammar::ParseError>(Contract::Serialize),
        presets: traq_markdown_grammar::bindings::preset_exports(),
        limits: serde_json::from_value(limits::metadata())?,
        nodes: node_metadata::export()?.nodes,
    };
    write(directory, &manifest)
}
