use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(rename_all = "lowercase")]
pub enum Alignment {
    Left,
    Center,
    Right,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, markdown_definitions::NodeType)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct TableData {}

impl markdown_ast::NodeData for TableData {}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, markdown_definitions::NodeType)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct RowData {
    pub header: bool,
}

impl markdown_ast::NodeData for RowData {}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, markdown_definitions::NodeType)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct CellData {
    pub alignment: Option<Alignment>,
}

impl markdown_ast::NodeData for CellData {}
