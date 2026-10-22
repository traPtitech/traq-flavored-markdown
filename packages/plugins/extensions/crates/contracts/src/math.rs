use markdown_ast::NodeRole;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct InlineMath {
    pub tex: String,
}

impl markdown_ast::NodeData for InlineMath {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| markdown_ast::NodeStructure::leaf(NodeRole::Inline));
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        self.tex.len()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct BlockMath {
    pub tex: String,
}

impl markdown_ast::NodeData for BlockMath {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| markdown_ast::NodeStructure::leaf(NodeRole::Block));
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        self.tex.len()
    }
}
