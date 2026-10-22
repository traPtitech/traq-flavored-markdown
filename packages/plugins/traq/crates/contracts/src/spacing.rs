use serde::{Deserialize, Serialize};

#[markdown_definitions::node(role = Block)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
/// A source blank line preserved for document layout.
pub struct BlankLine {}
