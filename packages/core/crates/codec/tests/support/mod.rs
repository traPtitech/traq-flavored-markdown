#![allow(dead_code)]

use markdown_ast::{Node, NodeData, NodeRole};
use markdown_definitions::WireTypeKey;
use serde::{Deserialize, Serialize};

// Synthetic contracts exercise the codec without depending on a grammar.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, WireTypeKey)]
#[wire_type(key = "test.paragraph")]
#[serde(deny_unknown_fields)]
pub struct Paragraph {}
impl NodeData for Paragraph {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure {
            role: NodeRole::Block,
            children: markdown_ast::ChildStructure::Any,
        };
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, WireTypeKey)]
#[wire_type(key = "test.text")]
#[serde(deny_unknown_fields)]
pub struct Text {
    pub value: String,
}
impl NodeData for Text {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure {
            role: NodeRole::Inline,
            children: markdown_ast::ChildStructure::Any,
        };
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        self.value.len()
    }
    fn validate_payload(&self, children: &[Node]) -> Result<(), markdown_ast::PayloadError> {
        let valid = children.is_empty();
        if valid {
            Ok(())
        } else {
            Err(markdown_ast::PayloadError::new("custom payload invariant"))
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, WireTypeKey)]
#[wire_type(key = "test.heading")]
#[serde(deny_unknown_fields)]
pub struct Heading {
    pub level: u8,
}
impl NodeData for Heading {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure {
            role: NodeRole::Block,
            children: markdown_ast::ChildStructure::Any,
        };
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate_payload(&self, _children: &[Node]) -> Result<(), markdown_ast::PayloadError> {
        let valid = (1..=6).contains(&self.level);
        if valid {
            Ok(())
        } else {
            Err(markdown_ast::PayloadError::new("custom payload invariant"))
        }
    }
}
