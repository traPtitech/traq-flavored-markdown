use markdown_extractor::Extractor;
use markdown_renderer::Renderer;
use traq_markdown_processing::{References, presets::traq};

#[test]
fn one_ast_supports_hidden_notifications_and_reference_collection() {
    let parser = traq_markdown_grammar::presets::traq::v1::parser();
    let renderer = Renderer::new(&traq::notification::preset("").unwrap());
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
    builder
        .remove(&markdown_trap_extraction::references::plugin())
        .unwrap();
    let empty = Extractor::new(&builder.build().unwrap());
    assert_eq!(empty.extract(&document).unwrap(), References::default());
    assert_eq!(extractor.extract(&document).unwrap().mentions, [id, id]);
}

#[test]
fn preset_configuration_is_independent_and_bounded() {
    let parser = traq_markdown_grammar::presets::traq::v1::parser();
    let source = "https://q.example.test/files/00000000-0000-0000-0000-000000000001";
    let document = parser.parse(source).unwrap();
    let special = Renderer::new(&traq::notification::preset("https://q.example.test").unwrap());
    let ordinary = Renderer::new(&traq::notification::preset("").unwrap());
    assert_eq!(special.render(&document).unwrap().trim(), "[添付ファイル]");
    assert_eq!(ordinary.render(&document).unwrap().trim(), source);
    assert_eq!(special.render(&document).unwrap().trim(), "[添付ファイル]");
    assert!(traq::notification::builder(&"x".repeat(2048)).is_ok());
    assert_eq!(
        traq::notification::builder(&"x".repeat(2049)).err(),
        Some("origin_limit")
    );
}
