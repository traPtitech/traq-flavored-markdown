use markdown_ast::NodeRole;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
/// A source blank line preserved for document layout.
pub struct BlankLine {}

impl markdown_ast::NodeData for BlankLine {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| markdown_ast::NodeStructure::leaf(NodeRole::Block));
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}
