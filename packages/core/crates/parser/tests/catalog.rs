use markdown_definitions::Plugin as Declaration;
use markdown_parser::{GrammarBuilder, NodeData, Parser, Plugin, bindings::Catalog};
use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};

#[derive(Debug, Clone, PartialEq)]
struct Text(String);

impl NodeData for Text {}

#[test]
fn registration_is_atomic_and_does_not_invoke_the_text_provider() {
    let calls = Arc::new(AtomicUsize::new(0));
    let count = calls.clone();
    let mut plugin = Plugin::new(&Declaration::new("text"));

    plugin.text(move |value| {
        count.fetch_add(1, Ordering::Relaxed);
        Text(value)
    });

    let mut catalog = Catalog::default();
    let index = catalog.plugin(&plugin);
    assert_eq!(catalog.plugin(&plugin), index);

    let before = catalog.describe();
    assert!(catalog.preset(&GrammarBuilder::new()).is_err());
    assert_eq!(catalog.describe(), before);

    let mut builder = GrammarBuilder::new();
    builder.add(&plugin).unwrap();

    let preset = catalog.preset(&builder).unwrap();
    assert_eq!(calls.load(Ordering::Relaxed), 0);

    let composition = catalog.preset_composition(preset).unwrap();
    let grammar = catalog.build(&composition).unwrap();
    assert_eq!(calls.load(Ordering::Relaxed), 0);

    let doc = Parser::new(&grammar).parse_inline("hello").unwrap();
    assert_eq!(calls.load(Ordering::Relaxed), 1);
    assert_eq!(doc.children[0].get::<Text>(), Some(&Text("hello".into())));

    let mut other = Plugin::new(&Declaration::new("another"));
    other.text(Text);
    builder.add(&other).unwrap();

    let before = catalog.describe();
    assert!(catalog.preset(&builder).is_err());
    assert_eq!(catalog.describe(), before);
}

#[test]
fn composition_keeps_group_identity_separate_from_names_and_rejects_bad_references() {
    let root = Declaration::group("root");
    let nested = root.group("nested");
    let mut plugin = Plugin::new(&nested.new("text"));
    plugin.text(Text);
    let mut builder = GrammarBuilder::new();
    builder.add(&plugin).unwrap();
    let mut catalog = Catalog::default();
    let preset = catalog.preset(&builder).unwrap();
    let composition = catalog.preset_composition(preset).unwrap();
    let mut renamed = composition.clone();
    renamed.groups[0].name = Some("renamed".into());
    let grammar = catalog.build(&renamed).unwrap();
    assert!(grammar.describe().contains("renamed/nested/text"));
    assert_eq!(plugin.namespace(), Some(&nested));
    assert_eq!(root.name(), "root");

    let mut broken = composition.clone();
    broken.groups[0].parent = Some(0);
    assert!(catalog.build(&broken).is_err());
    let mut broken = composition.clone();
    broken.plugins[0].text = vec![usize::MAX];
    assert!(catalog.build(&broken).is_err());
    let mut broken = composition;
    broken.plugins[0].name = None;
    assert!(catalog.build(&broken).is_err());
}
