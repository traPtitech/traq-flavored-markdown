use markdown_ast::{Node, NodeRole};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum ReferenceKind {
    User,
    Group,
    Channel,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct ReferenceData {
    #[serde(rename = "type")]
    pub target: ReferenceKind,
    pub id: String,
    pub label: String,
}

impl markdown_ast::NodeData for ReferenceData {
    fn role(&self) -> NodeRole {
        NodeRole::Inline
    }
    fn payload_bytes(&self) -> usize {
        self.id.len().saturating_add(self.label.len())
    }
    fn validate(&self, children: &[Node]) -> bool {
        children.is_empty()
    }
}
