use traq_markdown_grammar::{Document, bindings};
use traq_markdown_processing::extraction::{Extractor, ExtractorOptions};

fn parse(source: &str) -> Document {
    bindings::parser("traq.v1").unwrap().parse(source).unwrap()
}

#[test]
fn extractor_consumes_ast_and_preserves_message_metadata() {
    let extractor = Extractor::new(ExtractorOptions {
        origin: "https://q.example.test".into(),
    })
    .unwrap();
    let id = "00000000-0000-0000-0000-000000000001";
    let user = format!(r#"!{{"type":"user","id":"{id}","raw":"@alice"}}"#);
    let file = format!(r#"!{{"type":"file","id":"{id}"}}"#);
    let citation = format!(r#"!{{"type":"message","id":"{id}"}}"#);
    let source = format!("**{user}**\n{file} !!{citation}!!\nhttps://q.example.test/files/{id}\n");
    let document = parse(&source);
    let result = extractor.extract(&document).unwrap();
    assert_eq!(result.references.mentions, [id]);
    assert_eq!(result.attachments, [id, id]);
    assert_eq!(result.citations, [id]);
    assert!(result.message_text.contains("**@alice**"));
    assert!(result.message_text.contains("!![引用メッセージ]!!"));
    assert_eq!(extractor.extract(&document).unwrap(), result);
    assert_eq!(document.source, source);
}

#[test]
fn extractor_uses_supplied_ast_regardless_of_grammar() {
    let extractor = Extractor::new(ExtractorOptions::default()).unwrap();
    let source = r#"!{"type":"user","id":"00000000-0000-0000-0000-000000000001","raw":"@alice"}"#;
    let common = bindings::parser("commonmark")
        .unwrap()
        .parse(source)
        .unwrap();
    let traq = parse(source);
    assert!(
        extractor
            .extract(&common)
            .unwrap()
            .references
            .mentions
            .is_empty()
    );
    assert_eq!(
        extractor.extract(&traq).unwrap().references.mentions.len(),
        1
    );
    assert!(
        extractor
            .extract(&common)
            .unwrap()
            .references
            .mentions
            .is_empty()
    );
}

#[test]
fn invalid_ast_and_oversized_configuration_are_rejected() {
    assert!(
        Extractor::new(ExtractorOptions {
            origin: "x".repeat(2049)
        })
        .is_err()
    );
    let extractor = Extractor::new(ExtractorOptions::default()).unwrap();
    let mut invalid = parse("text");
    invalid.children[0].span.end += 1;
    assert!(extractor.extract(&invalid).is_err());
    assert_eq!(
        extractor.extract(&parse("**after**")).unwrap().message_text,
        "**after**"
    );
}
