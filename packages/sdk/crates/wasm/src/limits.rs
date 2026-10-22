// AST consumers accept the serialized output of the parser. Source limits remain in Parser.
#[path = "limits/memory.rs"]
mod memory;

pub use memory::MEMORY_BYTES;

pub const MAX_INPUT: usize = MAX_OUTPUT;
pub const MAX_OUTPUT: usize = 1_048_576;

/// Both the native exporter and running module derive limits from their owners.
pub fn metadata() -> serde_json::Value {
    let document = markdown_ast::ValidationLimits::default();
    serde_json::json!({
        "inputBytes": MAX_INPUT,
        "outputBytes": MAX_OUTPUT,
        "memoryBytes": MEMORY_BYTES,
        "document": {
            "sourceBytes": document.source_bytes,
            "payloadBytes": document.payload_bytes,
            "nodes": document.nodes,
            "depth": document.depth,
        },
    })
}
