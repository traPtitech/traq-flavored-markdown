use std::sync::LazyLock;

static CONTRACT: LazyLock<String> = LazyLock::new(|| {
    serde_json::json!({
        "contractId": crate::abi::CONTRACT_ID,
        "provenance": { "sourceFingerprint": env!("MARKDOWN_SOURCE_FINGERPRINT") },
        "abiVersion": 1,
        "presets": traq_markdown_grammar::bindings::preset_exports(),
        "limits": super::limits::metadata(),
    })
    .to_string()
});

#[unsafe(no_mangle)]
pub extern "C" fn contract_ptr() -> u32 {
    CONTRACT.as_ptr() as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn contract_len() -> u32 {
    CONTRACT.len() as u32
}
