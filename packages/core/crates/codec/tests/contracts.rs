use markdown_ast::{Document, Node, NodeData, Span};
use markdown_codec::Codec;
use markdown_definitions::NodeType;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, NodeType)]
#[serde(deny_unknown_fields)]
struct Score {
    value: f64,
}

impl NodeData for Score {
    fn validate(&self, children: &[Node]) -> bool {
        children.is_empty()
    }
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, NodeType)]
struct RenamedScore {
    value: f64,
}

impl NodeData for RenamedScore {}

#[test]
fn shared_types_work_across_independent_registration_orders() {
    let mut producer = Codec::default();
    let doc = Document {
        source: "猫".into(),
        children: vec![Node::leaf(Span { start: 0, end: 3 }, Score { value: 1.25 })],
    };

    assert!(producer.encode(&doc).is_err());
    producer.register::<Score>().unwrap();

    let bytes = producer.encode(&doc).unwrap();
    assert_eq!(producer.decode(&bytes).unwrap(), doc);

    let mut consumer = Codec::default();
    consumer.register::<RenamedScore>().unwrap();
    assert!(consumer.decode(&bytes).is_err()); // A renamed type is a new wire key.
    consumer.register::<Score>().unwrap();

    let restored = consumer.decode(&bytes).unwrap();
    assert_eq!(restored, doc);
    assert_eq!(consumer.encode(&restored).unwrap(), bytes);
    assert!(producer.register::<Score>().is_err());
    assert_eq!(producer.encode(&doc).unwrap(), bytes);
}

fn first(codec: &mut Codec) -> Document {
    #[derive(Debug, Clone, PartialEq, Serialize, Deserialize, NodeType)]
    struct Collision {
        value: u8,
    }

    impl NodeData for Collision {}

    codec.register::<Collision>().unwrap();

    Document {
        source: "".into(),
        children: vec![Node::leaf(
            Span { start: 0, end: 0 },
            Collision { value: 1 },
        )],
    }
}

fn second(codec: &mut Codec) -> Result<(), &'static str> {
    #[derive(Debug, Clone, PartialEq, Serialize, Deserialize, NodeType)]
    struct Collision {
        value: u16,
    }

    impl NodeData for Collision {}

    codec.register::<Collision>()
}

#[test]
fn distinct_local_types_with_the_same_generated_key_are_rejected_atomically() {
    let mut codec = Codec::default();
    let doc = first(&mut codec);
    let before = codec.encode(&doc).unwrap();

    assert!(second(&mut codec).is_err());
    assert_eq!(codec.encode(&doc).unwrap(), before);
    assert_eq!(codec.decode(&before).unwrap(), doc);
}
