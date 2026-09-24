use markdown_ast::Node;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct InlineMathData {
    pub tex: String,
}

impl markdown_ast::NodeData for InlineMathData {
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
    fn validate(&self, children: &[Node]) -> bool {
        children.is_empty()
    }
}
