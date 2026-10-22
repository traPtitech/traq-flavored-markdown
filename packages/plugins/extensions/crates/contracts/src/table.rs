use markdown_ast::{NodeData, NodeRole};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "lowercase")]
pub enum Alignment {
    Left,
    Center,
    Right,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Table {
    #[cfg_attr(feature = "contracts", schemars(length(min = 1)))]
    pub alignments: Vec<Option<Alignment>>,
}
impl NodeData for Table {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| markdown_ast::NodeStructure {
                role: NodeRole::Block,
                children: markdown_ast::ChildStructure::Sequence {
                    prefix: vec![markdown_ast::PayloadType::of::<HeaderRow>()],
                    rest: markdown_ast::PayloadType::of::<Row>(),
                    child_arity: Some(markdown_ast::ChildArity::new::<Table>(
                        "alignments",
                        |table| table.alignments.len(),
                    )),
                },
            });
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        self.alignments
            .len()
            .saturating_mul(std::mem::size_of::<Option<Alignment>>())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct HeaderRow {}
impl NodeData for HeaderRow {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| {
                markdown_ast::NodeStructure::children::<Cell>(NodeRole::Structural, true)
            });
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Row {}
impl NodeData for Row {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| {
                markdown_ast::NodeStructure::children::<Cell>(NodeRole::Structural, true)
            });
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Cell {}
impl NodeData for Cell {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: std::sync::LazyLock<markdown_ast::NodeStructure> =
            std::sync::LazyLock::new(|| {
                markdown_ast::NodeStructure::roles(NodeRole::Structural, NodeRole::Inline)
            });
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}
