use markdown_ast::{Document, Node, Span, ValidationLimits};
use markdown_codec::{Codec, CodecLimits, DecodeLimits};
mod support;
use markdown_definitions::NodeType;
use support::{Paragraph, Text};

fn codec() -> Codec {
    let mut codec = Codec::default();
    codec.register::<Paragraph>().unwrap();
    codec.register::<Text>().unwrap();
    codec
}

fn deep_json(depth: usize) -> String {
    let mut json = String::from(r#"{"source":"","children":["#);
    for _ in 1..depth {
        json.push_str(r#"{"kind":"<paragraph>","span":{"start":0,"end":0},"data":{},"children":["#);
    }
    json.push_str(r#"{"kind":"<paragraph>","span":{"start":0,"end":0},"data":{}}"#);
    for _ in 1..depth {
        json.push_str("]}");
    }
    json.push_str("]}");
    json.replace("<paragraph>", &Paragraph::type_key())
}

#[test]
fn bounded_input_and_output_accept_the_boundary() {
    let codec = codec();
    let span = Span { start: 0, end: 3 };
    let mut document = Document {
        source: "猫".into(),
        children: vec![Node::leaf(
            span,
            Text {
                value: "猫".into()
            },
        )],
    };

    let bytes = codec.encode(&document).unwrap();
    let limits = DecodeLimits {
        json_bytes: bytes.len(),
        document: ValidationLimits {
            source_bytes: 3,
            payload_bytes: 3,
            nodes: 1,
            depth: 1,
        },
    };
    assert_eq!(codec.decode_with_limits(&bytes, limits).unwrap(), document);

    for lower in [
        DecodeLimits {
            json_bytes: bytes.len() - 1,
            ..limits
        },
        DecodeLimits {
            document: ValidationLimits {
                source_bytes: 2,
                ..limits.document
            },
            ..limits
        },
        DecodeLimits {
            document: ValidationLimits {
                nodes: 0,
                ..limits.document
            },
            ..limits
        },
        DecodeLimits {
            document: ValidationLimits {
                depth: 0,
                ..limits.document
            },
            ..limits
        },
    ] {
        assert!(codec.decode_with_limits(&bytes, lower).is_err());
    }

    document.children[0].span.start = 1;
    assert!(codec.encode(&document).is_err());
    let text = String::from_utf8(bytes).unwrap();

    assert!(
        codec
            .decode(text.replace("\"start\":0", "\"start\":1").as_bytes())
            .is_err()
    );

    let at_limit = codec.decode(deep_json(64).as_bytes()).unwrap();

    assert!(codec.encode(&at_limit).is_ok());
    for depth in [65, 5000] {
        assert!(
            codec
                .decode(deep_json(depth).as_bytes())
                .unwrap_err()
                .to_string()
                .contains("depth limit")
        );
    }

    let mut too_deep = at_limit;
    too_deep.children = vec![Node::new(
        Span { start: 0, end: 0 },
        Paragraph {},
        too_deep.children,
    )];

    assert!(codec.encode(&too_deep).is_err());
    document.children = vec![Node::leaf(
        span,
        Text {
            value: "x".repeat(8 * 1024 * 1024),
        },
    )];

    assert!(
        codec
            .encode(&document)
            .unwrap_err()
            .to_string()
            .contains("json byte limit")
    );
}

#[test]
fn ambiguous_or_unknown_input_is_rejected() {
    let codec = codec();
    let doc = codec
        .encode(&Document {
            source: "".into(),
            children: vec![Node::leaf(
                Span { start: 0, end: 0 },
                Text { value: "".into() },
            )],
        })
        .unwrap();

    let json = String::from_utf8(doc).unwrap();
    for bad in [
        json.replace("\"source\":\"\"", "\"source\":\"\",\"source\":\"\""),
        json.replace("\"value\":\"\"", "\"value\":\"\",\"value\":\"\""),
        json.replace("\"value\":\"\"", "\"value\":\"\",\"unknown\":0"),
        json.replace("\"start\":0", "\"start\":0,\"start\":0"),
        json.replace("\"data\":", "\"unknown\":0,\"data\":"),
        json.replace(&Text::type_key(), "unregistered::Missing"),
        format!("{json} true"),
    ] {
        assert!(codec.decode(bad.as_bytes()).is_err());
    }

    assert!(codec.decode(&[0xff]).is_err());
}

#[test]
fn overlapping_siblings_are_rejected_at_both_codec_boundaries() {
    let codec = codec();
    let mut document = Document {
        source: "abc".into(),
        children: vec![
            Node::leaf(Span { start: 0, end: 2 }, Text { value: "ab".into() }),
            Node::leaf(Span { start: 2, end: 3 }, Text { value: "c".into() }),
        ],
    };

    let mut encoded: serde_json::Value =
        serde_json::from_slice(&codec.encode(&document).unwrap()).unwrap();
    document.children[1].span.start = 1;
    assert!(codec.encode(&document).is_err());

    encoded["children"][1]["span"]["start"] = serde_json::json!(1);
    assert!(
        codec
            .decode(&serde_json::to_vec(&encoded).unwrap())
            .is_err()
    );
}

#[test]
fn custom_limits_round_trip_above_the_default_source_budget() {
    let codec = codec();
    let source = "x".repeat(ValidationLimits::default().source_bytes + 1);
    let document = Document {
        children: vec![Node::leaf(
            Span {
                start: 0,
                end: source.len(),
            },
            Text {
                value: source.clone(),
            },
        )],
        source,
    };
    let limits = CodecLimits {
        json_bytes: 8 * 1024 * 1024,
        document: ValidationLimits {
            source_bytes: document.source.len(),
            ..ValidationLimits::default()
        },
    };

    assert!(codec.encode(&document).is_err());
    let bytes = codec.encode_with_limits(&document, limits).unwrap();
    assert!(codec.decode(&bytes).is_err());
    assert_eq!(codec.decode_with_limits(&bytes, limits).unwrap(), document);
    assert!(
        codec
            .encode_with_limits(
                &document,
                CodecLimits {
                    json_bytes: bytes.len() - 1,
                    ..limits
                }
            )
            .is_err()
    );
}

#[test]
fn payload_limit_is_enforced_by_both_codec_directions() {
    let codec = codec();
    let document = Document {
        source: String::new(),
        children: vec![
            Node::leaf(
                Span { start: 0, end: 0 },
                Text {
                    value: "abc".into(),
                },
            ),
            Node::leaf(
                Span { start: 0, end: 0 },
                Text {
                    value: "def".into(),
                },
            ),
        ],
    };
    let bytes = codec.encode(&document).unwrap();
    let limits = CodecLimits {
        json_bytes: bytes.len(),
        document: ValidationLimits {
            payload_bytes: 5,
            ..ValidationLimits::default()
        },
    };
    assert!(
        codec
            .encode_with_limits(&document, limits)
            .unwrap_err()
            .to_string()
            .contains("payload byte limit")
    );
    assert!(
        codec
            .decode_with_limits(&bytes, limits)
            .unwrap_err()
            .to_string()
            .contains("payload byte limit")
    );
}
