use markdown_ast::{Document, Node, NodeData, Span};
use markdown_definitions::Plugin as Declaration;
use markdown_extractor::{Extractor, Plugin, PresetBuilder};
use std::{
    cell::Cell,
    rc::Rc,
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
};

#[derive(Clone, Debug, PartialEq)]
struct Reference(u32);

impl NodeData for Reference {}
#[derive(Clone, Debug, PartialEq)]
struct Container;

impl NodeData for Container {}
#[derive(Clone, Debug, PartialEq)]
struct Invalid;

impl NodeData for Invalid {
    fn validate(&self, _: &[Node]) -> bool {
        false
    }
}

// A result need not be Clone, Send, or Sync.
#[derive(Default)]
struct Collected {
    ids: Vec<u32>,
    count: Rc<Cell<usize>>,
}

fn node<T: NodeData>(value: T, children: Vec<Node>) -> Node {
    Node::new(Span { start: 0, end: 0 }, value, children)
}

fn document(children: Vec<Node>) -> Document {
    Document {
        source: String::new(),
        children,
    }
}

fn plugin(calls: Arc<AtomicUsize>) -> Plugin<Collected> {
    let mut plugin = Plugin::new(&Declaration::new("references"));
    plugin
        .on::<Reference>(move |value, result: &mut Collected| {
            calls.fetch_add(1, Ordering::Relaxed);
            if value.0 == 99 {
                return Err("handler_failure");
            }
            result.ids.push(value.0);
            result.count.set(result.count.get() + 1);
            Ok(())
        })
        .unwrap();
    plugin
}

fn extractor(plugin: &Plugin<Collected>) -> Extractor<Collected> {
    let mut builder = PresetBuilder::new();
    builder.add(plugin).unwrap();
    Extractor::new(&builder.build().unwrap())
}

#[test]
fn fresh_results_keep_preorder_duplicates_and_unregistered_descendants() {
    let calls = Arc::new(AtomicUsize::new(0));
    let extractor = extractor(&plugin(calls.clone()));

    let doc = document(vec![node(
        Container,
        vec![
            node(Reference(1), vec![node(Reference(2), vec![])]),
            node(Reference(1), vec![]),
        ],
    )]);

    let first = extractor.extract(&doc).unwrap();
    assert_eq!(first.ids, [1, 2, 1]);
    assert_eq!(first.count.get(), 3);

    // The extractor can cross threads even when its result cannot.
    std::thread::spawn(move || {
        let second = extractor.extract(&doc).unwrap();
        assert_eq!(second.ids, [1, 2, 1]);
        assert_eq!(second.count.get(), 3);
    })
    .join()
    .unwrap();

    assert_eq!(calls.load(Ordering::Relaxed), 6);
}

#[test]
fn validation_precedes_all_handlers_and_failed_runs_do_not_leak_results() {
    let calls = Arc::new(AtomicUsize::new(0));
    let extractor = extractor(&plugin(calls.clone()));

    let doc = document(vec![
        node(Reference(1), vec![]),
        node(Container, vec![node(Invalid, vec![])]),
    ]);

    assert!(matches!(extractor.extract(&doc), Err("invalid_node")));
    assert_eq!(calls.load(Ordering::Relaxed), 0);

    let mut doc = document(vec![node(Reference(1), vec![])]);
    doc.source = "é".into();
    doc.children[0].span = Span { start: 1, end: 2 };

    assert!(matches!(extractor.extract(&doc), Err("invalid_node")));
    assert_eq!(calls.load(Ordering::Relaxed), 0);

    let doc = document(vec![
        node(Reference(1), vec![]),
        node(Reference(99), vec![]),
    ]);

    assert!(matches!(extractor.extract(&doc), Err("handler_failure")));
    assert!(extractor.extract(&document(vec![])).unwrap().ids.is_empty());
}

#[test]
fn snapshots_duplicate_rejection_and_removal_are_atomic() {
    let mut plugin = plugin(Arc::new(AtomicUsize::new(0)));
    let original = plugin.clone();
    let mut builder = PresetBuilder::new();

    builder.add(&plugin).unwrap();
    let old = Extractor::new(&builder.clone().build().unwrap());

    assert!(builder.add(&plugin).is_err());
    assert!(plugin.on::<Reference>(|_, _| Ok(())).is_err());

    builder.clone().remove(&plugin).unwrap();
    plugin
        .on::<Container>(|_, result| {
            result.ids.push(3);
            Ok(())
        })
        .unwrap();

    assert!(builder.remove(&plugin).is_err());
    assert!(builder.add(&plugin).is_err());

    let doc = document(vec![node(Container, vec![])]);

    assert!(old.extract(&doc).unwrap().ids.is_empty());
    assert!(
        Extractor::new(&builder.clone().build().unwrap())
            .extract(&doc)
            .unwrap()
            .ids
            .is_empty()
    );

    builder.remove(&original).unwrap().add(&plugin).unwrap();

    assert_eq!(
        Extractor::new(&builder.build().unwrap())
            .extract(&doc)
            .unwrap()
            .ids,
        [3]
    );
}

#[test]
fn limits_also_apply_to_unregistered_nodes() {
    let extractor = extractor(&plugin(Arc::new(AtomicUsize::new(0))));
    let mut doc = document(vec![node(Container, vec![]); 16_384]);

    assert!(extractor.extract(&doc).is_ok());

    doc.children.push(node(Container, vec![]));

    assert!(matches!(extractor.extract(&doc), Err("resource_limit")));

    let mut root = node(Container, vec![]);

    for _ in 1..64 {
        root = node(Container, vec![root]);
    }

    doc.children = vec![root];
    assert!(extractor.extract(&doc).is_ok());

    doc.children = vec![node(Container, doc.children)];
    assert!(matches!(extractor.extract(&doc), Err("resource_limit")));

    doc.children.clear();
    doc.source = "x".repeat(65_536);
    assert!(extractor.extract(&doc).is_ok());

    doc.source.push('x');
    assert!(matches!(extractor.extract(&doc), Err("resource_limit")));
}

#[test]
fn selected_names_are_checked_using_namespace_identity() {
    let group = Declaration::group("generic");
    let mut builder = PresetBuilder::<Collected>::new();

    builder.add(&Plugin::new(&group.new("same"))).unwrap();
    builder.add(&Plugin::new(&group.new("same"))).unwrap();
    assert!(matches!(builder.build(), Err("duplicate_name")));

    let mut builder = PresetBuilder::<Collected>::new();

    builder
        .add(&Plugin::new(&group.group("one").new("same")))
        .unwrap();

    builder
        .add(&Plugin::new(&group.group("two").new("same")))
        .unwrap();

    assert!(builder.build().is_ok());
}
