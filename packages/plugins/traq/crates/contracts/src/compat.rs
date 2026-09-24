use markdown_ast::{Node, NodeRole};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct BlankLineData {}

impl markdown_ast::NodeData for BlankLineData {
    fn role(&self) -> NodeRole {
        NodeRole::Block
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate(&self, children: &[Node]) -> bool {
        children.is_empty()
    }
}
