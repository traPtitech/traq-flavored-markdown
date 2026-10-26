use markdown_ast::NodeRole;
use serde::{Deserialize, Serialize};

#[markdown_definitions::payload]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "lowercase")]
pub enum Alignment {
    Left,
    Center,
    Right,
}

#[markdown_definitions::node(structure = table_structure)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Table {
    #[constraint(length(min = 1))]
    pub alignments: Vec<Option<Alignment>>,
}

#[markdown_definitions::node(role = Structural, child_type = Cell, nonempty)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HeaderRow {}

#[markdown_definitions::node(role = Structural, child_type = Cell, nonempty)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Row {}

#[markdown_definitions::node(role = Structural, children = Inline)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Cell {}

fn table_structure() -> &'static markdown_ast::NodeStructure {
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
