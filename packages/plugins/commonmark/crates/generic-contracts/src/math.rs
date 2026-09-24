use markdown_ast::{Node, NodeRole};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct InlineMathData {
    pub tex: String,
}

impl markdown_ast::NodeData for InlineMathData {
    fn role(&self) -> NodeRole {
        NodeRole::Inline
    }
    fn payload_bytes(&self) -> usize {
        self.tex.len()
    }
    fn validate(&self, children: &[Node]) -> bool {
        children.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct BlockMathData {
    pub tex: String,
}

impl markdown_ast::NodeData for BlockMathData {
    fn role(&self) -> NodeRole {
        NodeRole::Block
    }
    fn payload_bytes(&self) -> usize {
        self.tex.len()
    }
    fn validate(&self, children: &[Node]) -> bool {
        children.is_empty()
    }
}
