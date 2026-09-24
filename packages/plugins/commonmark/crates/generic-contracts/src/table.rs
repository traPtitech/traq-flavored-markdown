use markdown_ast::{Node, NodeData, NodeRole};
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
pub struct TableData {}

impl NodeData for TableData {
    fn role(&self) -> NodeRole {
        NodeRole::Block
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate(&self, children: &[Node]) -> bool {
        let Some(header) = children.first() else {
            return false;
        };
        if !header.get::<RowData>().is_some_and(|row| row.header) || header.children.is_empty() {
            return false;
        }

        children.iter().enumerate().all(|(index, node)| {
            node.get::<RowData>().is_some_and(|row| {
                row.header == (index == 0)
                    && node.children.len() == header.children.len()
                    && node
                        .children
                        .iter()
                        .zip(&header.children)
                        .all(|(cell, first)| {
                            cell.get::<CellData>()
                                .zip(first.get::<CellData>())
                                .is_some_and(|(cell, first)| cell.alignment == first.alignment)
                        })
            })
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct RowData {
    pub header: bool,
}

impl NodeData for RowData {
    fn role(&self) -> NodeRole {
        NodeRole::Structural
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate(&self, children: &[Node]) -> bool {
        !children.is_empty() && children.iter().all(|node| node.get::<CellData>().is_some())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct CellData {
    pub alignment: Option<Alignment>,
}

impl NodeData for CellData {
    fn role(&self) -> NodeRole {
        NodeRole::Structural
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate(&self, children: &[Node]) -> bool {
        inline_children(children)
    }
}

pub(crate) fn inline_children(children: &[Node]) -> bool {
    children.iter().all(|node| node.role() == NodeRole::Inline)
}
