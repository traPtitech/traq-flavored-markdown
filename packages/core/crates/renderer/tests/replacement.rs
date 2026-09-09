use markdown_ast::{Document, Node, NodeData, Span};
use markdown_definitions::Plugin as Declaration;
use markdown_renderer::{Plugin, PresetBuilder, Renderer};
use std::sync::Arc;

#[derive(Clone, Debug, PartialEq)]
struct Text;
impl NodeData for Text {}

#[derive(Clone, Debug, PartialEq)]
struct Other;
impl NodeData for Other {}

fn document<T: NodeData>(value: T) -> Document {
    Document {
        source: String::new(),
        children: vec![Node::leaf(Span { start: 0, end: 0 }, value)],
    }
}

fn renderer(plugin: &Plugin) -> Renderer {
    let mut builder = PresetBuilder::new();
    builder.add(plugin).unwrap();
    Renderer::new(&builder.build().unwrap())
}

#[test]
fn replacement_changes_only_the_selected_type_in_the_new_snapshot() {
    let old_config = Arc::new("old".to_owned());
    let old_weak = Arc::downgrade(&old_config);
    let mut plugin = Plugin::new(&Declaration::new("configured"));

    plugin
        .on::<Text>(move |_, _, _| Ok((*old_config).clone()))
        .unwrap();
    plugin.on::<Other>(|_, _, _| Ok("other".into())).unwrap();

    let old = renderer(&plugin);
    let config = Arc::new("new".to_owned());
    let weak = Arc::downgrade(&config);

    plugin
        .replace::<Text>(move |_, _, _| Ok((*config).clone()))
        .unwrap();

    assert!(plugin.on::<Text>(|_, _, _| Ok("duplicate".into())).is_err());

    let new = renderer(&plugin);
    drop(plugin);

    assert_eq!(old.render(&document(Text)).unwrap(), "old");
    assert_eq!(new.render(&document(Text)).unwrap(), "new");
    assert_eq!(new.render(&document(Other)).unwrap(), "other");
    assert!(old_weak.upgrade().is_some());
    assert!(weak.upgrade().is_some());
    drop(old);
    assert!(old_weak.upgrade().is_none());
    assert!(weak.upgrade().is_some());
    drop(new);
    assert!(weak.upgrade().is_none());
}

#[test]
fn missing_replacement_is_atomic_and_does_not_register_a_handler() {
    let mut plugin = Plugin::new(&Declaration::new("text"));
    plugin.on::<Text>(|_, _, _| Ok("unchanged".into())).unwrap();
    let mut builder = PresetBuilder::new();
    builder.add(&plugin).unwrap();
    assert_eq!(
        plugin.replace::<Other>(|_, _, _| Ok("unexpected".into())),
        Err("missing_handler")
    );
    // Failure must not fork the registered implementation snapshot.
    builder.remove(&plugin).unwrap();
    let renderer = renderer(&plugin);
    assert_eq!(renderer.render(&document(Other)), Err("unsupported_node"));
    assert_eq!(renderer.render(&document(Text)).unwrap(), "unchanged");
}
