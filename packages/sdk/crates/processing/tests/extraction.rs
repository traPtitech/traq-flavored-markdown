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

#[test]
fn source_edits_accept_reordered_and_duplicate_nodes_but_reject_crossing_ranges() {
    use traq_markdown_processing::presets::traq::{embedding, message};
    let parser = bindings::parser("traq.v1").unwrap();
    let user = |name: &str| {
        format!(r#"!{{"type":"user","id":"00000000-0000-0000-0000-000000000001","raw":"@{name}"}}"#)
    };
    let original = parser
        .parse_inline(&format!("{} {}", user("alice"), user("bob")))
        .unwrap();
    let extractor = Extractor::new(ExtractorOptions::default()).unwrap();

    let mut reordered = original.clone();
    reordered.children.reverse();
    let mut duplicated = original.clone();
    duplicated.children.extend(original.children.clone());
    for document in [reordered, duplicated] {
        assert_eq!(
            extractor.extract(&document).unwrap().message_text,
            "@alice @bob"
        );
        assert_eq!(
            embedding::plan(&document).unwrap().unembedded_text,
            "@alice @bob"
        );
    }

    let mut crossing = original.clone();
    crossing.children.last_mut().unwrap().span.start = original.children[0].span.end - 1;
    assert_eq!(embedding::plan(&crossing).unwrap_err(), "overlapping_edits");
    assert_eq!(
        message::Extractor::new("").extract(&crossing).unwrap_err(),
        "overlapping_edits"
    );
    assert_eq!(
        extractor.extract(&crossing).unwrap_err(),
        "overlapping_edits"
    );
    assert_eq!(
        extractor.extract(&original).unwrap().message_text,
        "@alice @bob"
    );

    let mut mentions = parser.parse_inline("@alice **@bob**").unwrap();
    let expected = embedding::plan(&mentions).unwrap();
    mentions.children.reverse();
    assert_eq!(embedding::plan(&mentions).unwrap(), expected);
}

#[test]
fn aggregate_extraction_validates_each_node_once() {
    use markdown_ast::{Node, NodeData, Span};
    use std::sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    };
    #[derive(Clone, Debug)]
    struct Counted(Arc<AtomicUsize>);
    impl PartialEq for Counted {
        fn eq(&self, other: &Self) -> bool {
            Arc::ptr_eq(&self.0, &other.0)
        }
    }
    impl NodeData for Counted {
        fn validate(&self, _: &[Node]) -> bool {
            self.0.fetch_add(1, Ordering::Relaxed);
            true
        }
    }
    let calls = Arc::new(AtomicUsize::new(0));
    let mut document = Document {
        source: String::new(),
        children: vec![Node::leaf(
            Span { start: 0, end: 0 },
            Counted(calls.clone()),
        )],
    };
    let extractor = Extractor::new(ExtractorOptions::default()).unwrap();
    extractor.extract(&document).unwrap();
    assert_eq!(calls.load(Ordering::Relaxed), 1);
    // Validation belongs to each call, never to a mutable AST's identity.
    document.children[0].span.end = 1;
    assert!(extractor.extract(&document).is_err());
}
