use markdown_ast::{MutableDocument, Node, NodeData, NodeRole, Span};
use markdown_codec::Codec;
use markdown_definitions::NodeType;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, NodeType)]
#[node_type(key = "example.heading")]
struct Heading {
    level: u8,
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
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, NodeType)]
#[node_type(key = "example.text")]
struct Text {
    value: String,
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

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut codec = Codec::default();

    codec.register::<Heading>()?;
    codec.register::<Text>()?;

    let document = MutableDocument {
        source: "# hello".into(),
        children: vec![Node::new(
            Span { start: 0, end: 7 },
            Heading { level: 1 },
            vec![Node::leaf(
                Span { start: 2, end: 7 },
                Text {
                    value: "hello".into(),
                },
            )],
        )],
    };

    let json = codec.encode(&document)?;
    let decoded = codec.decode(&json)?;

    assert_eq!(*decoded, document);
    println!("{}", String::from_utf8(json)?);

    Ok(())
}
