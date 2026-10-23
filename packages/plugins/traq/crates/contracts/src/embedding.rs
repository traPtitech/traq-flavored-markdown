use serde::{Deserialize, Serialize};

#[markdown_definitions::payload]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum EmbeddingKind {
    File,
    Message,
}

#[markdown_definitions::node(role = Inline)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Embedding {
    #[serde(rename = "type")]
    pub target: EmbeddingKind,
    pub id: String,
    pub label: String,
    /// Original JSON notation, available to renderers that display it as text.
    pub literal: String,
}
