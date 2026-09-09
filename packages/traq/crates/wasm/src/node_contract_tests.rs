use crate::nodes;
use markdown_ast::{Document, Node, Span};
use markdown_commonmark_contracts::{Heading, Text};
use markdown_definitions::NodeType;
use serde_json::Value;

#[test]
fn exported_types_cover_public_fixtures_and_roundtrip_the_native_tree() {
    let output =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../target/node-contract-tests");
    let metadata =
        crate::node_metadata::export(&ts_rs::Config::default().with_out_dir(output)).unwrap();

    assert_eq!(metadata.as_object().unwrap().len(), 29);
    let commonmark = traq_markdown_grammar::presets::commonmark::parser();
    let traq = traq_markdown_grammar::presets::traq::v1::parser();
    let mut count = 0;

    for (file, parser) in [
        ("commonmark-0.31.2.json", &commonmark),
        ("traq-v1-extensions.json", &traq),
    ] {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../tests/fixtures")
            .join(file);
        let cases: Vec<Value> = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
        for case in cases {
            let document = parser
                .parse(
                    case["markdown"]
                        .as_str()
                        .or_else(|| case["source"].as_str())
                        .unwrap(),
                )
                .unwrap();
            let json = nodes::codec().encode(&document).unwrap();
            assert_eq!(nodes::codec().decode(&json).unwrap(), document);
            let value: Value = serde_json::from_slice(&json).unwrap();
            let mut pending: Vec<_> = value["children"].as_array().unwrap().iter().collect();
            while let Some(node) = pending.pop() {
                assert!(metadata.get(node["kind"].as_str().unwrap()).is_some());
                assert!(node["data"].is_object());
                assert!(node.get("name").is_none());
                if let Some(children) = node["children"].as_array() {
                    pending.extend(children);
                }
            }
            count += 1;
        }
    }

    assert_eq!(count, 673);
}

#[test]
fn native_semantic_validation_is_applied_at_both_codec_boundaries() {
    let document = Document {
        source: "x".into(),
        children: vec![Node::leaf(Span { start: 0, end: 1 }, Heading { level: 7 })],
    };

    assert!(nodes::codec().encode(&document).is_err());
    let json = serde_json::json!({"source":"x", "children":[{
        "kind":Heading::type_key(),"span":{"start":0,"end":1},"data":{"level":7}
    }]});
    assert!(
        nodes::codec()
            .decode(&serde_json::to_vec(&json).unwrap())
            .is_err()
    );

    let child = Node::leaf(Span { start: 0, end: 1 }, Text { value: "x".into() });
    let document = Document {
        source: "x".into(),
        children: vec![Node::new(
            Span { start: 0, end: 1 },
            Text { value: "x".into() },
            vec![child],
        )],
    };
    assert!(nodes::codec().encode(&document).is_err());
}
