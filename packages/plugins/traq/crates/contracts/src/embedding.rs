use markdown_ast::NodeRole;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum EmbeddingKind {
    File,
    Message,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Embedding {
    #[serde(rename = "type")]
    pub target: EmbeddingKind,
    pub id: String,
    pub label: String,
    /// Original JSON notation, available to renderers that display it as text.
    pub literal: String,
}

impl markdown_ast::NodeData for Embedding {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| markdown_ast::NodeStructure::leaf(NodeRole::Inline));
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        self.id
            .len()
            .saturating_add(self.label.len())
            .saturating_add(self.literal.len())
    }
}
