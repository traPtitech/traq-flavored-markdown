use markdown_ast::{MutableDocument, Node, Span, ValidationLimits};
use markdown_codec::{Codec, CodecLimits};
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
    let mut document = MutableDocument {
        source: "猫".into(),
        children: vec![Node::leaf(
            span,
            Text {
                value: "猫".into()
            },
        )],
    };

    let bytes = codec.encode(&document).unwrap();
    let limits = CodecLimits {
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
        CodecLimits {
            json_bytes: bytes.len() - 1,
            ..limits
        },
        CodecLimits {
            document: ValidationLimits {
                source_bytes: 2,
                ..limits.document
            },
            ..limits
        },
        CodecLimits {
            document: ValidationLimits {
                nodes: 0,
                ..limits.document
            },
            ..limits
        },
        CodecLimits {
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
                .resource()
                == Some("depth")
        );
    }

    let mut too_deep = at_limit.into_mutable();
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

    assert!(codec.encode(&document).unwrap_err().resource() == Some("json_bytes"));
}

#[test]
fn ambiguous_or_unknown_input_is_rejected() {
    let codec = codec();
    let doc = codec
        .encode(&MutableDocument {
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
    let mut document = MutableDocument {
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
    let document = MutableDocument {
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
    let document = MutableDocument {
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
            .resource()
            == Some("payload_bytes")
    );
    assert!(
        codec
            .decode_with_limits(&bytes, limits)
            .unwrap_err()
            .resource()
            == Some("payload_bytes")
    );
}

#[test]
fn decode_failures_keep_field_contract_span_and_nested_path() {
    use markdown_codec::ErrorKind;
    let codec = codec();
    let mut json = serde_json::json!({
        "source": "é",
        "children": [{"kind": Paragraph::type_key(), "data": {}, "span": {"start":0,"end":2}, "children": [
            {"kind": Text::type_key(), "data":{"value":"é"}, "span":{"start":1,"end":2}}
        ]}]
    });
    let error = codec
        .decode(&serde_json::to_vec(&json).unwrap())
        .unwrap_err();
    assert!(matches!(error.kind, ErrorKind::InvalidSpan { .. }));
    assert_eq!(error.path, [0, 0]);
    assert_eq!(error.span, Some(Span { start: 1, end: 2 }));
    json["children"][0]["children"][0]["span"]["start"] = 0.into();
    json["children"][0]["children"][0]["kind"] = "missing.payload".into();
    let error = codec
        .decode(&serde_json::to_vec(&json).unwrap())
        .unwrap_err();
    assert!(
        matches!(error.kind, ErrorKind::UnknownContract { ref name } if name == "missing.payload")
    );
    assert_eq!(error.path, [0, 0]);
    json["children"][0]["children"][0]["kind"] = Text::type_key().into();
    json["children"][0]["children"][0]
        .as_object_mut()
        .unwrap()
        .remove("data");
    let error = codec
        .decode(&serde_json::to_vec(&json).unwrap())
        .unwrap_err();
    assert!(matches!(error.kind, ErrorKind::MissingField { ref name } if name == "data"));
    assert_eq!(error.path, [0, 0]);
    assert_eq!(error.span, Some(Span { start: 0, end: 2 }));
}
