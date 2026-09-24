#![allow(dead_code)]

use markdown_ast::{Node, NodeData, NodeRole};
use markdown_definitions::NodeType;
use serde::{Deserialize, Serialize};

// Synthetic contracts exercise the codec without depending on a grammar.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, NodeType)]
#[node_type(key = "test.paragraph")]
#[serde(deny_unknown_fields)]
pub struct Paragraph {}
impl NodeData for Paragraph {
    fn role(&self) -> NodeRole {
        NodeRole::Block
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, NodeType)]
#[node_type(key = "test.text")]
#[serde(deny_unknown_fields)]
pub struct Text {
    pub value: String,
}
impl NodeData for Text {
    fn role(&self) -> NodeRole {
        NodeRole::Inline
    }
    fn payload_bytes(&self) -> usize {
        self.value.len()
    }
    fn validate(&self, children: &[Node]) -> bool {
        children.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, NodeType)]
#[node_type(key = "test.heading")]
#[serde(deny_unknown_fields)]
pub struct Heading {
    pub level: u8,
}
impl NodeData for Heading {
    fn role(&self) -> NodeRole {
        NodeRole::Block
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate(&self, _children: &[Node]) -> bool {
        (1..=6).contains(&self.level)
    }
}
