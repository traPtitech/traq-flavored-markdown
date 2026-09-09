use markdown_ast::{Document, Node, NodeData, Span};
use markdown_definitions::Plugin as Declaration;
use markdown_renderer::{Plugin, PresetBuilder, Renderer};
use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};

#[derive(Debug, Clone, PartialEq)]
struct Text(String);
impl NodeData for Text {}

#[derive(Debug, Clone, PartialEq)]
struct Hidden;
impl NodeData for Hidden {}

#[derive(Debug, Clone, PartialEq)]
struct Invalid;
impl NodeData for Invalid {
    fn validate(&self, _: &[Node]) -> bool {
        false
    }
}

#[derive(Debug, Clone, PartialEq)]
struct Unknown;
impl NodeData for Unknown {}

fn leaf<T: NodeData>(value: T) -> Node {
    Node::leaf(Span { start: 0, end: 0 }, value)
}

fn renderer(calls: Arc<AtomicUsize>) -> Renderer {
    let mut plugin = Plugin::new(&Declaration::new("validation"));
    plugin.on::<Text>(|v, _, _| Ok(v.0.clone())).unwrap();

    plugin
        .on::<Hidden>(move |_, _, _| {
            calls.fetch_add(1, Ordering::Relaxed);
            Ok("hidden".into())
        })
        .unwrap();

    plugin
        .on::<Invalid>(|_, _, _| Ok("invalid".into()))
        .unwrap();

    let mut builder = PresetBuilder::new();
    builder.add(&plugin).unwrap();
    Renderer::new(&builder.build().unwrap())
}

#[test]
fn suppressed_descendants_are_checked_before_running_any_handler() {
    let calls = Arc::new(AtomicUsize::new(0));
    let renderer = renderer(calls.clone());

    for (child, expected) in [
        (leaf(Unknown), "unsupported_node"),
        (leaf(Invalid), "invalid_node"),
        (
            Node::leaf(Span { start: 1, end: 2 }, Text("bad span".into())),
            "invalid_node",
        ),
    ] {
        let doc = Document {
            source: "é".into(),
            children: vec![Node::new(Span { start: 0, end: 2 }, Hidden, vec![child])],
        };

        assert_eq!(renderer.render(&doc), Err(expected));
    }

    assert_eq!(calls.load(Ordering::Relaxed), 0);
}

#[test]
fn resource_boundaries_and_per_render_budgets_are_preserved() {
    let renderer = renderer(Arc::new(AtomicUsize::new(0)));

    let mut doc = Document {
        source: String::new(),
        children: vec![leaf(Text("x".repeat(1_048_576)))],
    };

    assert_eq!(renderer.render(&doc).unwrap().len(), 1_048_576);
    assert_eq!(renderer.render(&doc).unwrap().len(), 1_048_576);
    doc.children[0] = leaf(Text("x".repeat(1_048_577)));
    assert_eq!(renderer.render(&doc), Err("resource_limit"));

    doc.children = vec![leaf(Text(String::new())); 16_384];
    assert_eq!(renderer.render(&doc).unwrap(), "");
    doc.children.push(leaf(Text(String::new())));
    assert_eq!(renderer.render(&doc), Err("resource_limit"));

    let mut node = leaf(Text(String::new()));
    for _ in 1..64 {
        node = Node::new(Span { start: 0, end: 0 }, Hidden, vec![node]);
    }

    doc.children = vec![node];
    assert_eq!(renderer.render(&doc).unwrap(), "hidden");

    doc.children = vec![Node::new(Span { start: 0, end: 0 }, Hidden, doc.children)];
    assert_eq!(renderer.render(&doc), Err("resource_limit"));

    doc.children.clear();
    doc.source = "x".repeat(65_536);
    assert_eq!(renderer.render(&doc).unwrap(), "");

    doc.source.push('x');
    assert_eq!(renderer.render(&doc), Err("resource_limit"));
}
