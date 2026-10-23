use serde::Serialize;
use std::sync::LazyLock;
use traq_markdown_grammar::bindings::{ExportTree, PresetId};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Provenance {
    source_fingerprint: &'static str,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeContract {
    contract_id: &'static str,
    provenance: Provenance,
    abi_version: u32,
    presets: ExportTree<PresetId>,
    limits: super::limits::ArtifactLimits,
}

static CONTRACT: LazyLock<String> = LazyLock::new(|| {
    serde_json::to_string(&RuntimeContract {
        contract_id: crate::abi::CONTRACT_ID,
        provenance: Provenance {
            source_fingerprint: env!("MARKDOWN_SOURCE_FINGERPRINT"),
        },
        abi_version: 1,
        presets: traq_markdown_grammar::bindings::preset_exports(),
        limits: super::limits::metadata(),
    })
    .expect("runtime contract is serializable")
});

#[unsafe(no_mangle)]
pub extern "C" fn contract_ptr() -> u32 {
    CONTRACT.as_ptr() as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn contract_len() -> u32 {
    CONTRACT.len() as u32
}
