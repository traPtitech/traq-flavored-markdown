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
use traq_markdown_processing::rendering::RendererOptions;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let directory = std::env::args().nth(1).ok_or("Pass the output directory")?;
    let parse_error = schemars::generate::SchemaSettings::default()
        .with(|settings| settings.contract = schemars::generate::Contract::Serialize)
        .into_generator()
        .into_root_schema_for::<traq_markdown_grammar::ParseError>();

    let mut processing = serde_json::Map::new();
    macro_rules! processing_type {
        ($direction:ident; $($ty:ident),*) => {
            $(
                let schema = schemars::generate::SchemaSettings::default()
                    .with(|settings| {
                        settings.contract = schemars::generate::Contract::$direction
                    })
                    .into_generator()
                    .into_root_schema_for::<$ty>();
                processing.insert(
                    stringify!($ty).into(),
                    serde_json::to_value(schema)?,
                );
            )*
        };
    }
    processing_type!(Deserialize; ExtractorOptions, RendererOptions);
    processing_type!(Serialize; Extraction);

    // Check that metadata and codec registrations agree before writing bindings.
    let _ = nodes::codec();
    let manifest = serde_json::json!({
        "contractId": abi::CONTRACT_ID,
        "provenance": { "sourceFingerprint": env!("MARKDOWN_SOURCE_FINGERPRINT") },
        "abi": abi::descriptor(),
        "directions": { "ExtractorOptions": "request", "RendererOptions": "request", "Extraction": "response" },
        "processing": processing,
        "parseError": parse_error,
        "presets": traq_markdown_grammar::bindings::preset_exports(),
        "limits": limits::metadata(),
        "nodes": node_metadata::export()?,
    });

    std::fs::create_dir_all(&directory)?;
    std::fs::write(
        std::path::Path::new(&directory).join("contracts.json"),
        serde_json::to_vec_pretty(&manifest)?,
    )?;
    Ok(())
}
