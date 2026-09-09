use markdown_ast::{Document, Node, NodeData, Span};
use markdown_codec::Codec;
use markdown_definitions::NodeType;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, NodeType)]
struct Heading {
    level: u8,
}

impl NodeData for Heading {
    fn validate(&self, _children: &[Node]) -> bool {
        (1..=6).contains(&self.level)
    }
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, NodeType)]
struct Text {
    value: String,
}

impl NodeData for Text {
    fn validate(&self, children: &[Node]) -> bool {
        children.is_empty()
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut codec = Codec::default();

    codec.register::<Heading>()?;
    codec.register::<Text>()?;

    let document = Document {
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

    assert_eq!(document, decoded);
    println!("{}", String::from_utf8(json)?);

    Ok(())
}
