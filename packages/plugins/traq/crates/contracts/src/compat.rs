use markdown_ast::Node;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct BlankLineData {}

impl markdown_ast::NodeData for BlankLineData {
    fn validate(&self, children: &[Node]) -> bool {
        children.is_empty()
    }
}
