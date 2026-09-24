use markdown_ast::Node;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct SpoilerData {}

impl markdown_ast::NodeData for SpoilerData {
    fn validate(&self, children: &[Node]) -> bool {
        children
            .iter()
            .all(|node| node.get::<crate::BlankLineData>().is_none())
    }
}
