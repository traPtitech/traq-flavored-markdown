use markdown_ast::{Node, NodeData, PayloadFields, Span};

#[markdown_definitions::payload]
#[derive(Debug, Clone, PartialEq)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
enum Detail {
    Empty,
    Labels { names: Vec<String> },
}

#[markdown_definitions::node(role = Inline)]
#[derive(Debug, Clone, PartialEq)]
struct Wrapped<T>(T);

#[markdown_definitions::node(role = Inline)]
#[derive(Debug, Clone, PartialEq)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
struct Custom {
    #[constraint(range(min = 1, max = 6))]
    level: u8,
    #[constraint(range(min = 0.0, max = 100.0))]
    percent: f64,
    #[constraint(length(max = 2))]
    labels: Vec<String>,
    detail: Option<Box<Detail>>,
}

fn custom() -> Custom {
    Custom {
        level: 2,
        percent: 50.0,
        labels: vec!["日".into()],
        detail: Some(Box::new(Detail::Labels {
            names: vec!["a".into(), "bc".into()],
        })),
    }
}

#[test]
fn fields_account_for_nested_owned_storage_without_per_node_bookkeeping() {
    let payload = custom();
    assert_eq!(
        payload.payload_bytes(),
        3 * std::mem::size_of::<String>() + std::mem::size_of::<Detail>() + 6
    );
    assert_eq!(Detail::Empty.heap_bytes(), 0);
    assert_eq!(Wrapped("value".to_owned()).payload_bytes(), 5);
    assert!(
        Node::leaf(Span { start: 0, end: 0 }, payload)
            .validate()
            .is_ok()
    );
}

#[test]
fn derived_fields_reject_out_of_range_and_nonfinite_values_and_oversized_arrays() {
    let span = Span { start: 0, end: 0 };
    for level in [0, 7, u8::MAX] {
        let mut payload = custom();
        payload.level = level;
        assert!(Node::leaf(span, payload).validate().is_err());
    }
    for percent in [-1.0, 100.1, f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
        let mut payload = custom();
        payload.percent = percent;
        assert!(Node::leaf(span, payload).validate().is_err());
    }
    let mut payload = custom();
    payload.labels = vec![String::new(); 3];
    assert!(Node::leaf(span, payload).validate().is_err());
}

#[cfg(feature = "contracts")]
#[test]
fn the_same_field_constraints_are_exported_in_the_schema() {
    let schema = schemars::schema_for!(Custom);
    let properties = &schema.as_value()["properties"];
    assert_eq!(properties["level"]["minimum"], 1);
    assert_eq!(properties["level"]["maximum"], 6);
    assert_eq!(properties["percent"]["minimum"], 0.0);
    assert_eq!(properties["percent"]["maximum"], 100.0);
    assert_eq!(properties["labels"]["maxItems"], 2);
}

#[markdown_definitions::node(role = Inline)]
#[derive(Debug, Clone, PartialEq)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
struct UnicodeLabel {
    #[constraint(length(min = 2, max = 2))]
    value: String,
}

#[test]
fn string_constraints_count_unicode_scalars_while_heap_limits_count_bytes() {
    let span = Span { start: 0, end: 0 };
    let value = UnicodeLabel {
        value: "日😀".into(),
    };
    assert_eq!(value.payload_bytes(), 7);
    assert!(Node::leaf(span, value).validate().is_ok());
    for value in ["日", "abc", "日😀字"] {
        assert!(
            Node::leaf(
                span,
                UnicodeLabel {
                    value: value.into()
                }
            )
            .validate()
            .is_err()
        );
    }
    #[cfg(feature = "contracts")]
    {
        let schema = schemars::schema_for!(UnicodeLabel);
        let value = &schema.as_value()["properties"]["value"];
        assert_eq!(value["minLength"], 2);
        assert_eq!(value["maxLength"], 2);
    }
}

#[markdown_definitions::node(role = Inline)]
#[derive(Debug, Clone, PartialEq)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
struct LowerBound {
    #[constraint(range(min = 0.0))]
    value: f64,
}

#[test]
fn nonfinite_floats_are_invalid_with_or_without_numeric_bounds() {
    let span = Span { start: 0, end: 0 };
    for value in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
        assert!(Node::leaf(span, Wrapped(value)).validate().is_err());
        assert!(Node::leaf(span, Wrapped(value as f32)).validate().is_err());
        assert!(Node::leaf(span, LowerBound { value }).validate().is_err());
    }
    assert!(
        Node::leaf(span, LowerBound { value: f64::MAX })
            .validate()
            .is_ok()
    );
}
