use markdown_extractor::Extractor;
use markdown_renderer::Renderer;
use traq_markdown_processing::{References, presets::traq};

#[test]
fn processing_reuses_the_tree_and_names_its_whitespace_policy() {
    use traq_markdown_processing::{
        pipeline::{Processor, ProcessorOptions},
        rendering::WhitespacePolicy,
    };
    let document = traq_markdown_grammar::presets::traq::v1::parser()
        .parse("hello\n\nworld")
        .unwrap();
    let collapsed = Processor::new(ProcessorOptions::default())
        .unwrap()
        .process(document.as_view())
        .unwrap();
    let preserved = Processor::new(ProcessorOptions {
        whitespace: WhitespacePolicy::Preserve,
        ..Default::default()
    })
    .unwrap()
    .process(document.as_view())
    .unwrap();
    assert_eq!(collapsed.plain_text, "hello world");
    assert!(preserved.plain_text.contains('\n'));
    assert_eq!(collapsed.extraction, preserved.extraction);
}

#[test]
fn one_ast_supports_plain_text_and_reference_collection() {
    let parser = traq_markdown_grammar::presets::traq::v1::parser();
    let renderer = Renderer::new(&traq::plain_text::preset("").unwrap());
    let extractor = Extractor::new(&traq::references::preset().unwrap());
    let id = "00000000-0000-0000-0000-000000000001";
    let reference = format!(r#"!{{"type":"user","id":"{id}","raw":"@alice"}}"#);
    let source = format!("{reference} !!{reference}!! `{reference}`\n\n```\n{reference}\n```");
    let document = parser.parse(&source).unwrap();
    assert_eq!(extractor.extract(&document).unwrap().mentions, [id, id]);
    assert_eq!(
        renderer
            .render(&document)
            .unwrap()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" "),
        format!("@alice ██████ {reference} {reference}")
    );

    let mut builder = traq::references::builder().unwrap();
    let registration = builder
        .registration(&markdown_traq_extraction::references::plugin())
        .unwrap();
    builder.remove(&registration).unwrap();
    let empty = Extractor::new(&builder.build().unwrap());
    assert_eq!(empty.extract(&document).unwrap(), References::default());
    assert_eq!(extractor.extract(&document).unwrap().mentions, [id, id]);
}

#[test]
fn preset_configuration_is_independent_and_bounded() {
    let parser = traq_markdown_grammar::presets::traq::v1::parser();
    let source = "https://q.example.test/files/00000000-0000-0000-0000-000000000001";
    let document = parser.parse(&format!("<{source}>")).unwrap();
    let special = Renderer::new(&traq::plain_text::preset("https://q.example.test").unwrap());
    let ordinary = Renderer::new(&traq::plain_text::preset("").unwrap());
    assert_eq!(special.render(&document).unwrap().trim(), "[添付ファイル]");
    assert_eq!(ordinary.render(&document).unwrap().trim(), source);
    assert_eq!(special.render(&document).unwrap().trim(), "[添付ファイル]");
    assert!(traq::plain_text::builder(&"x".repeat(2048)).is_ok());
    assert!(traq::message::Extractor::new(&"x".repeat(2048)).is_ok());
    assert_eq!(
        traq::plain_text::builder(&"x".repeat(2049))
            .err()
            .map(|error| error.resource()),
        Some(Some("origin_bytes"))
    );
    assert_eq!(
        traq::message::Extractor::new(&"x".repeat(2049))
            .err()
            .map(|error| error.resource()),
        Some(Some("origin_bytes"))
    );
    // The contract is a byte limit, including multibyte origins.
    assert!(traq::message::Extractor::new(&"é".repeat(1024)).is_ok());
    assert_eq!(
        traq::message::Extractor::new(&"é".repeat(1025))
            .err()
            .map(|error| error.resource()),
        Some(Some("origin_bytes"))
    );
}
