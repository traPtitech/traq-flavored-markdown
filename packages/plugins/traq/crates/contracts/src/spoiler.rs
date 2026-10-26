use serde::{Deserialize, Serialize};

#[markdown_definitions::node(role = Inline, children = Inline)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Spoiler {}
