use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, markdown_definitions::NodeType)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct InlineMathData {
    pub tex: String,
}

impl markdown_ast::NodeData for InlineMathData {}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, markdown_definitions::NodeType)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct BlockMathData {
    pub tex: String,
}

impl markdown_ast::NodeData for BlockMathData {}
