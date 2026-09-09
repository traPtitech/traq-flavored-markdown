#![allow(dead_code)]

use markdown_ast::{Node, NodeData};
use markdown_definitions::NodeType;
use serde::{Deserialize, Serialize};

// Synthetic contracts exercise the codec without depending on a grammar.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, NodeType)]
#[serde(deny_unknown_fields)]
pub struct Paragraph {}
impl NodeData for Paragraph {}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, NodeType)]
#[serde(deny_unknown_fields)]
pub struct Text {
    pub value: String,
}
impl NodeData for Text {
    fn validate(&self, children: &[Node]) -> bool {
        children.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, NodeType)]
#[serde(deny_unknown_fields)]
pub struct Heading {
    pub level: u8,
}
impl NodeData for Heading {
    fn validate(&self, _children: &[Node]) -> bool {
        (1..=6).contains(&self.level)
    }
}
