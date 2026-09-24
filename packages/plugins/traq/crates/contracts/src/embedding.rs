use markdown_ast::{Node, NodeRole};
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
pub struct EmbeddingData {
    #[serde(rename = "type")]
    pub target: EmbeddingKind,
    pub id: String,
    pub label: String,
    /// Original JSON notation, available to renderers that display it as text.
    pub literal: String,
}

impl markdown_ast::NodeData for EmbeddingData {
    fn role(&self) -> NodeRole {
        NodeRole::Inline
    }
    fn payload_bytes(&self) -> usize {
        self.id
            .len()
            .saturating_add(self.label.len())
            .saturating_add(self.literal.len())
    }
    fn validate(&self, children: &[Node]) -> bool {
        children.is_empty()
    }
}
