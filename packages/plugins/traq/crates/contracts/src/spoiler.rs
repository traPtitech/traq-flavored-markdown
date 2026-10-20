use markdown_ast::NodeRole;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Spoiler {}

impl markdown_ast::NodeData for Spoiler {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| {
                markdown_ast::NodeStructure::roles(NodeRole::Inline, NodeRole::Inline)
            });
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}
