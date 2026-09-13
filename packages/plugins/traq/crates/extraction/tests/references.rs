use markdown_ast::{Document, Node, Span};
use markdown_extractor::{Extractor, PresetBuilder};
use markdown_trap_contracts::{ReferenceData, ReferenceKind};
use markdown_trap_extraction::{References, references};

#[test]
fn normalized_references_preserve_order_duplicates_and_categories() {
    let mut builder = PresetBuilder::new();
    builder.add(&references::plugin()).unwrap();

    let extractor = Extractor::new(&builder.build().unwrap());
    let id = "aabbccdd-0000-0000-0000-000000000001";

    let forms = [
        id.to_owned(),
        id.to_uppercase(),
        id.replace('-', ""),
        format!("{{{id}}}"),
        format!("{{{}}}", id.replace('-', "")),
        format!("urn:uuid:{id}"),
        format!("urn:uuid:{}", id.replace('-', "")),
        "invalid".into(),
        format!("{id}/extra"),
        "あ".repeat(12),
    ];

    let mut document = Document {
        source: "x".into(),
        children: vec![],
    };

    for target in [
        ReferenceKind::User,
        ReferenceKind::Group,
        ReferenceKind::Channel,
    ] {
        for id in &forms {
            document.children.push(Node::leaf(
                Span { start: 0, end: 1 },
                ReferenceData {
                    target,
                    id: id.clone(),
                    label: "label".into(),
                },
            ));
        }
    }

    let result = extractor.extract(&document).unwrap();
    assert_eq!(result.mentions, vec![id; 7]);
    assert_eq!(result.group_mentions, vec![id; 7]);
    assert_eq!(result.channel_links, vec![id; 7]);

    assert_eq!(
        serde_json::to_value(&result).unwrap(),
        serde_json::json!({
            "mentions": vec![id; 7],
            "groupMentions": vec![id; 7],
            "channelLinks": vec![id; 7],
            "embeddings": result.embeddings
        })
    );

    document.children.clear();
    assert_eq!(extractor.extract(&document).unwrap(), References::default());
}
