use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum ReferenceKind {
    User,
    Group,
    Channel,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, markdown_definitions::NodeType)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct ReferenceData {
    #[serde(rename = "type")]
    pub target: ReferenceKind,
    pub id: String,
    pub label: String,
}

impl markdown_ast::NodeData for ReferenceData {}
