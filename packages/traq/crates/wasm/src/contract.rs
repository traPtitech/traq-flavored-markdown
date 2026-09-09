use std::sync::LazyLock;

static CONTRACT: LazyLock<String> = LazyLock::new(|| {
    serde_json::json!({
        "abiVersion": 3,
        "astVersion": 4,
        "buildId": env!("MARKDOWN_BUILD_ID"),
        "presets": traq_markdown_grammar::bindings::bundled().exports["presets"],
        "limits": {
            "inputBytes": super::limits::MAX_INPUT,
            "outputBytes": super::limits::MAX_OUTPUT,
            "memoryBytes": super::limits::MEMORY_BYTES
        }
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
