use serde::{Deserialize, Serialize};

#[markdown_definitions::payload]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum ReferenceKind {
    User,
    Group,
    Channel,
}

#[markdown_definitions::node(role = Inline)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Reference {
    #[serde(rename = "type")]
    pub target: ReferenceKind,
    pub id: String,
    pub label: String,
}
