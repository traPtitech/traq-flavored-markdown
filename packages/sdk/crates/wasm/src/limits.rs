// AST consumers accept the serialized output of the parser. Source limits remain in Parser.
#[path = "limits/memory.rs"]
mod memory;

pub use memory::MEMORY_BYTES;

pub const MAX_INPUT: usize = MAX_OUTPUT;
pub const MAX_OUTPUT: usize = 1_048_576;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentLimits {
    pub source_bytes: usize,
    pub payload_bytes: usize,
    pub nodes: usize,
    pub depth: usize,
}
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactLimits {
    pub input_bytes: usize,
    pub output_bytes: usize,
    pub memory_bytes: usize,
    pub document: DocumentLimits,
}

/// Both the native exporter and running module derive limits from their owners.
pub fn metadata() -> ArtifactLimits {
    let document = markdown_ast::ValidationLimits::default();
    ArtifactLimits {
        input_bytes: MAX_INPUT,
        output_bytes: MAX_OUTPUT,
        memory_bytes: MEMORY_BYTES,
        document: DocumentLimits {
            source_bytes: document.source_bytes,
            payload_bytes: document.payload_bytes,
            nodes: document.nodes,
            depth: document.depth,
        },
    }
}

#[cfg(feature = "contracts")]
impl From<ArtifactLimits> for markdown_contract_export::ArtifactLimits {
    fn from(limits: ArtifactLimits) -> Self {
        Self {
            input_bytes: limits.input_bytes,
            output_bytes: limits.output_bytes,
            memory_bytes: limits.memory_bytes,
            document: markdown_contract_export::DocumentLimits {
                source_bytes: limits.document.source_bytes,
                payload_bytes: limits.document.payload_bytes,
                nodes: limits.document.nodes,
                depth: limits.document.depth,
            },
        }
    }
}
