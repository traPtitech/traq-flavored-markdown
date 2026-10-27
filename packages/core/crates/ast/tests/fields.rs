use markdown_ast::PayloadFields;

#[test]
fn dynamic_payload_accounting_counts_contents_independently_of_reserved_capacity() {
    let mut text = String::with_capacity(128);
    text.push('猫');
    assert_eq!(text.dynamic_payload_bytes(), 3);
    assert_eq!(
        text.dynamic_payload_bytes(),
        text.clone().dynamic_payload_bytes()
    );

    let mut labels = Vec::with_capacity(16);
    assert_eq!(labels.dynamic_payload_bytes(), 0);
    labels.push(text);
    assert_eq!(
        labels.dynamic_payload_bytes(),
        std::mem::size_of::<String>() + 3
    );
    assert_eq!(
        labels.dynamic_payload_bytes(),
        labels.clone().dynamic_payload_bytes()
    );

    let nested = Some(Box::new(labels));
    assert_eq!(
        nested.dynamic_payload_bytes(),
        std::mem::size_of::<Vec<String>>() + std::mem::size_of::<String>() + 3
    );
}
