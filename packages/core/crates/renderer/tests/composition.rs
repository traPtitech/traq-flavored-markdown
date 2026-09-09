use markdown_ast::{Document, Node, NodeData, Span};
use markdown_definitions::Plugin as Declaration;
use markdown_renderer::{Plugin, PresetBuilder, Renderer};
use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};

#[derive(Debug, Clone, PartialEq)]
struct Text;
impl NodeData for Text {}

#[derive(Debug, Clone, PartialEq)]
struct Other;
impl NodeData for Other {}

fn document<T: NodeData>(value: T) -> Document {
    Document {
        source: String::new(),
        children: vec![Node::leaf(Span { start: 0, end: 0 }, value)],
    }
}

#[test]
fn parser_and_renderer_use_one_declaration_and_borrow_the_same_ast() {
    let declaration = Declaration::new("shared text");
    let mut syntax = markdown_parser::Plugin::new(&declaration);
    syntax.text(|_| Text);

    let mut grammar = markdown_parser::GrammarBuilder::new();
    grammar.add(&syntax).unwrap();

    let parser = markdown_parser::Parser::new(&grammar.build().unwrap());

    let mut rendering = Plugin::new(&declaration);
    rendering
        .on::<Text>(|_, _, _| Ok("rendered".into()))
        .unwrap();

    let mut builder = PresetBuilder::new();
    builder.add(&rendering).unwrap();

    let renderer = Renderer::new(&builder.build().unwrap());
    let document = parser.parse_inline("hello").unwrap();

    assert_eq!(renderer.render(&document).unwrap(), "rendered");
    assert_eq!(document.children[0].get::<Text>(), Some(&Text));
    assert_eq!(document.source, "hello");
}

#[test]
fn captured_configuration_is_shared_and_outlives_the_preset() {
    let calls = Arc::new(AtomicUsize::new(0));
    let weak = Arc::downgrade(&calls);
    let mut plugin = Plugin::new(&Declaration::new("configured"));
    plugin
        .on::<Text>(move |_, _, _| Ok(calls.fetch_add(1, Ordering::Relaxed).to_string()))
        .unwrap();

    let mut builder = PresetBuilder::new();
    builder.add(&plugin).unwrap();

    let preset = builder.build().unwrap();
    let first = Renderer::new(&preset);
    let second = Renderer::new(&preset);

    drop(preset);
    drop(plugin);

    assert_eq!(first.render(&document(Text)).unwrap(), "0");

    // Move an independent renderer to another thread, using the same capture.
    std::thread::spawn(move || {
        assert_eq!(second.render(&document(Text)).unwrap(), "1");
    })
    .join()
    .unwrap();

    assert!(weak.upgrade().is_some());
    drop(first);

    assert!(weak.upgrade().is_none());
}

#[test]
fn snapshots_are_isolated_and_failed_registration_is_atomic() {
    let mut plugin = Plugin::new(&Declaration::new("first"));
    plugin.on::<Text>(|_, _, _| Ok("first".into())).unwrap();

    let registered = plugin.clone();
    let mut builder = PresetBuilder::new();
    builder.add(&plugin).unwrap();

    let renderer = Renderer::new(&builder.clone().build().unwrap());
    assert!(builder.add(&plugin).is_err());
    assert!(plugin.on::<Text>(|_, _, _| Ok("duplicate".into())).is_err());

    // A rejected handler does not produce a new snapshot.
    let mut copy = builder.clone();
    copy.remove(&plugin).unwrap();

    plugin.on::<Other>(|_, _, _| Ok("new".into())).unwrap();

    assert!(builder.remove(&plugin).is_err());
    assert_eq!(renderer.render(&document(Other)), Err("unsupported_node"));

    builder.remove(&registered).unwrap();
    builder.add(&plugin).unwrap();

    assert_eq!(
        Renderer::new(&builder.build().unwrap())
            .render(&document(Other))
            .unwrap(),
        "new"
    );

    assert_eq!(renderer.render(&document(Text)).unwrap(), "first");

    let mut conflict = Plugin::new(&Declaration::new("conflict"));
    conflict.on::<Other>(|_, _, _| Ok("leaked".into())).unwrap();
    conflict.on::<Text>(|_, _, _| Ok("wrong".into())).unwrap();

    let mut builder = PresetBuilder::new();
    builder.add(&registered).unwrap();
    assert!(builder.add(&conflict).is_err());

    let renderer = Renderer::new(&builder.build().unwrap());
    assert_eq!(renderer.render(&document(Other)), Err("unsupported_node"));
    assert_eq!(renderer.render(&document(Text)).unwrap(), "first");
}

#[test]
fn display_name_validation_uses_shared_group_identity() {
    let group = Declaration::group("generic");
    let left = Plugin::new(&group.group("left").new("same"));
    let right = Plugin::new(&group.group("right").new("same"));
    let mut builder = PresetBuilder::new();
    builder.add(&left).unwrap().add(&right).unwrap();
    assert!(builder.build().is_ok());

    let first = Plugin::new(&group.new("same"));
    let second = Plugin::new(&group.new("same"));
    let mut builder = PresetBuilder::new();
    builder.add(&first).unwrap().add(&second).unwrap();
    assert!(matches!(builder.build(), Err("duplicate_name")));

    let unrelated = Declaration::group("generic");
    let other = Plugin::new(&unrelated.new("other"));
    let mut builder = PresetBuilder::new();
    builder.add(&first).unwrap().add(&other).unwrap();
    assert!(matches!(builder.build(), Err("duplicate_name")));
}
