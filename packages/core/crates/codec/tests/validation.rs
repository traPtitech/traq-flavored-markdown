use markdown_ast::{MutableDocument, Node, NodeData, NodeRole, Span};
use markdown_codec::Codec;
mod support;
use markdown_definitions::NodeType;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicUsize, Ordering};
use support::{Heading, Text};

static CHECKS: AtomicUsize = AtomicUsize::new(0);
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, NodeType)]
#[node_type(key = "test.group")]
struct Group {}

impl NodeData for Group {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure {
            role: NodeRole::Opaque,
            children: markdown_ast::ChildStructure::Any,
        };
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate_payload(&self, children: &[Node]) -> Result<(), markdown_ast::PayloadError> {
        let valid = {
            CHECKS.fetch_add(1, Ordering::Relaxed);
            children
                .iter()
                .all(|node| node.get::<Group>().is_some() || node.get::<Text>().is_some())
        };
        if valid {
            Ok(())
        } else {
            Err(markdown_ast::PayloadError::new("custom payload invariant"))
        }
    }
}

#[test]
fn type_owned_checks_apply_once_per_node_in_both_directions() {
    let mut codec = Codec::default();

    codec.register::<Heading>().unwrap();
    codec.register::<Text>().unwrap();
    codec.register::<Group>().unwrap();

    let span = Span { start: 0, end: 1 };

    let mut doc = MutableDocument {
        source: "x".into(),
        children: vec![Node::new(
            span,
            Group {},
            vec![Node::new(
                span,
                Group {},
                vec![Node::leaf(span, Text { value: "x".into() })],
            )],
        )],
    };

    let bytes = codec.encode(&doc).unwrap();

    assert_eq!(CHECKS.swap(0, Ordering::Relaxed), 2);

    let validated = codec.decode(&bytes).unwrap();
    assert_eq!(CHECKS.swap(0, Ordering::Relaxed), 2);
    assert_eq!(validated.as_view().node_count(), 3);
    assert_eq!(codec.encode(validated.as_view()).unwrap(), bytes);
    assert_eq!(codec.encode(validated.as_view()).unwrap(), bytes);
    let view = codec
        .serialization_view(&validated, Default::default())
        .unwrap();
    let mut streamed = vec![];
    markdown_codec::write_json(&mut streamed, &view, bytes.len()).unwrap();
    assert_eq!(streamed, bytes);
    assert_eq!(
        markdown_codec::write_json(Vec::new(), &view, bytes.len() - 1)
            .unwrap_err()
            .resource(),
        Some("json_bytes")
    );
    assert_eq!(
        CHECKS.load(Ordering::Relaxed),
        0,
        "proof survives boundary reuse"
    );

    let limited = markdown_codec::CodecLimits {
        document: markdown_ast::ValidationLimits {
            nodes: 2,
            ..Default::default()
        },
        ..Default::default()
    };
    assert!(
        codec
            .encode_with_limits(validated.as_view(), limited)
            .is_err()
    );
    assert_eq!(
        CHECKS.load(Ordering::Relaxed),
        0,
        "tightening limits uses validation facts"
    );
    assert_eq!(validated.into_mutable(), doc);
    assert_eq!(codec.decode(&bytes).unwrap(), doc);
    assert_eq!(CHECKS.swap(0, Ordering::Relaxed), 2);

    doc.children[0]
        .children
        .push(Node::leaf(span, Heading { level: 2 }));

    assert!(codec.encode(&doc).is_err()); // The child is valid, but this parent forbids its type.

    doc.children = vec![Node::leaf(span, Heading { level: 2 })];

    let json = String::from_utf8(codec.encode(&doc).unwrap()).unwrap();
    doc.children[0].get_mut::<Heading>().unwrap().level = 7;

    assert!(codec.encode(&doc).is_err());
    assert!(
        codec
            .decode(json.replace("\"level\":2", "\"level\":7").as_bytes())
            .is_err()
    );

    let mut invalid: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    invalid["children"][0]["children"][0]["children"][0]["children"] = serde_json::json!([{ "kind": Text::type_key(), "span": {"start":0,"end":1}, "data":{"value":"x"} }]);

    assert!(
        codec
            .decode(&serde_json::to_vec(&invalid).unwrap())
            .is_err()
    );
}
