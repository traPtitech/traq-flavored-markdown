use serde::{Deserialize, Serialize};

#[markdown_definitions::node(role = Inline)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InlineMath {
    pub tex: String,
}

#[markdown_definitions::node(role = Block)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BlockMath {
    pub tex: String,
}
