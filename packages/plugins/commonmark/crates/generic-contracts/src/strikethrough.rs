use markdown_ast::Node;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct StrikethroughData {}

impl markdown_ast::NodeData for StrikethroughData {
    fn validate(&self, children: &[Node]) -> bool {
        crate::table::inline_children(children)
    }
}
