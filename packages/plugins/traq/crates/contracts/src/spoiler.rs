use markdown_ast::{Node, NodeRole};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct SpoilerData {}

impl markdown_ast::NodeData for SpoilerData {
    fn role(&self) -> NodeRole {
        NodeRole::Inline
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate(&self, children: &[Node]) -> bool {
        children.iter().all(|node| node.role() == NodeRole::Inline)
    }
}
