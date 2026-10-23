use markdown_ast::{MutableDocument, Node, NodeData, NodeRole, Span};
use markdown_definitions::PluginDeclaration as Declaration;
use markdown_renderer::RenderPlugin;
use markdown_renderer::RenderPresetBuilder;
use markdown_renderer::Renderer;
use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};

#[derive(Debug, Clone, PartialEq)]
struct Text(String);
impl NodeData for Text {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure {
            role: NodeRole::Inline,
            children: markdown_ast::ChildStructure::Any,
        };
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        self.0.len()
    }
}

#[derive(Debug, Clone, PartialEq)]
struct Hidden;
impl NodeData for Hidden {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure {
            role: NodeRole::Opaque,
            children: markdown_ast::ChildStructure::Any,
        };
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}

#[derive(Debug, Clone, PartialEq)]
struct Invalid;
impl NodeData for Invalid {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure {
            role: NodeRole::Opaque,
            children: markdown_ast::ChildStructure::Any,
        };
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
    fn validate_payload(&self, _: &[Node]) -> Result<(), markdown_ast::PayloadError> {
        let valid = false;
        if valid {
            Ok(())
        } else {
            Err(markdown_ast::PayloadError::new("custom payload invariant"))
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
struct Unknown;
impl NodeData for Unknown {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure {
            role: NodeRole::Opaque,
            children: markdown_ast::ChildStructure::Any,
        };
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}

fn leaf<T: NodeData>(value: T) -> Node {
    Node::leaf(Span { start: 0, end: 0 }, value)
}

fn renderer(calls: Arc<AtomicUsize>) -> Renderer {
    let mut plugin = RenderPlugin::new(&Declaration::new("validation"));
    plugin
        .on::<Text>(|v, _, _, output| output.push(&v.0))
        .unwrap();

    plugin
        .on::<Hidden>(move |_, _, _, output| {
            calls.fetch_add(1, Ordering::Relaxed);
            output.push("hidden")
        })
        .unwrap();

    plugin
        .on::<Invalid>(|_, _, _, output| output.push("invalid"))
        .unwrap();

    let mut builder = RenderPresetBuilder::new();
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
        let doc = MutableDocument {
            source: "é".into(),
            children: vec![Node::new(Span { start: 0, end: 2 }, Hidden, vec![child])],
        };

        assert_eq!(
            renderer.render(&doc).map_err(|error| error.code()),
            Err(expected)
        );
    }

    assert_eq!(calls.load(Ordering::Relaxed), 0);
}

#[test]
fn resource_boundaries_and_per_render_budgets_are_preserved() {
    let renderer = renderer(Arc::new(AtomicUsize::new(0)));

    let mut doc = MutableDocument {
        source: String::new(),
        children: vec![leaf(Text("x".repeat(1_048_576)))],
    };

    assert_eq!(
        renderer
            .render(&doc)
            .map_err(|error| error.code())
            .unwrap()
            .len(),
        1_048_576
    );
    assert_eq!(
        renderer
            .render(&doc)
            .map_err(|error| error.code())
            .unwrap()
            .len(),
        1_048_576
    );
    doc.children[0] = leaf(Text("x".repeat(1_048_577)));
    assert_eq!(
        renderer.render(&doc).map_err(|error| error.code()),
        Err("resource_limit")
    );

    doc.children = vec![leaf(Text(String::new())); 16_384];
    assert_eq!(
        renderer.render(&doc).map_err(|error| error.code()).unwrap(),
        ""
    );
    doc.children.push(leaf(Text(String::new())));
    assert_eq!(
        renderer.render(&doc).map_err(|error| error.code()),
        Err("resource_limit")
    );

    let mut node = leaf(Text(String::new()));
    for _ in 1..64 {
        node = Node::new(Span { start: 0, end: 0 }, Hidden, vec![node]);
    }

    doc.children = vec![node];
    assert_eq!(
        renderer.render(&doc).map_err(|error| error.code()).unwrap(),
        "hidden"
    );

    doc.children = vec![Node::new(Span { start: 0, end: 0 }, Hidden, doc.children)];
    assert_eq!(
        renderer.render(&doc).map_err(|error| error.code()),
        Err("resource_limit")
    );

    doc.children.clear();
    doc.source = "x".repeat(65_536);
    assert_eq!(
        renderer.render(&doc).map_err(|error| error.code()).unwrap(),
        ""
    );

    doc.source.push('x');
    assert_eq!(
        renderer.render(&doc).map_err(|error| error.code()),
        Err("resource_limit")
    );
}

#[test]
fn oversized_native_payload_is_rejected_before_a_handler_clones_it() {
    let mut plugin = RenderPlugin::new(&Declaration::new("payload boundary"));
    plugin
        .on::<Text>(|_, _, _, _| panic!("handler must not run"))
        .unwrap();
    let mut builder = RenderPresetBuilder::new();
    builder.add(&plugin).unwrap();
    let renderer = Renderer::new(&builder.build().unwrap());
    let document = MutableDocument {
        source: String::new(),
        children: vec![leaf(Text(
            "x".repeat(markdown_ast::ValidationLimits::default().payload_bytes + 1),
        ))],
    };

    assert_eq!(
        renderer.render(&document).map_err(|error| error.code()),
        Err("resource_limit")
    );
}

#[test]
fn writer_charges_each_byte_once_through_deep_wrappers_and_bounds_captures() {
    use markdown_renderer::{Error, RenderLimits};
    let mut plugin = RenderPlugin::new(&Declaration::new("streaming"));
    plugin
        .on::<Text>(|text, _, _, output| output.push(&text.0))
        .unwrap();
    plugin
        .on::<Hidden>(|_, nodes, context, output| context.children(nodes, output))
        .unwrap();
    let mut builder = RenderPresetBuilder::new();
    builder.add(&plugin).unwrap();
    let mut root = leaf(Text("hello".into()));
    for _ in 1..64 {
        root = Node::new(Span { start: 0, end: 0 }, Hidden, vec![root]);
    }
    let document = MutableDocument {
        source: String::new(),
        children: vec![root],
    };
    let limits = RenderLimits {
        output_bytes: 5,
        work_bytes: 5,
    };
    let renderer = Renderer::new(&builder.build().unwrap()).with_limits(limits);
    assert_eq!(renderer.render(&document).unwrap(), "hello");

    plugin
        .replace::<Hidden>(|_, nodes, context, output| {
            output.push(&context.capture_children(nodes)?)
        })
        .unwrap();
    let mut builder = RenderPresetBuilder::new();
    builder.add(&plugin).unwrap();
    let captured = Renderer::new(&builder.build().unwrap()).with_limits(limits);
    assert!(matches!(
        captured.render(&document),
        Err(Error::ResourceLimit {
            resource: "work_bytes",
            limit: 5
        })
    ));
}
