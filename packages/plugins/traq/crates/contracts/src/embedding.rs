use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum EmbeddingKind {
    File,
    Message,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, markdown_definitions::NodeType)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct EmbeddingData {
    #[serde(rename = "type")]
    pub target: EmbeddingKind,
    pub id: String,
    pub label: String,
    /// Original JSON notation, available to renderers that display it as text.
    pub literal: String,
}

impl markdown_ast::NodeData for EmbeddingData {}
