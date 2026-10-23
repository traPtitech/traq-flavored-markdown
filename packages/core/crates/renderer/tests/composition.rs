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
struct Text;
impl NodeData for Text {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure {
            role: NodeRole::Inline,
            children: markdown_ast::ChildStructure::Any,
        };
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        0
    }
}

#[derive(Debug, Clone, PartialEq)]
struct Other;
impl NodeData for Other {
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

fn document<T: NodeData>(value: T) -> MutableDocument {
    MutableDocument {
        source: String::new(),
        children: vec![Node::leaf(Span { start: 0, end: 0 }, value)],
    }
}

#[test]
fn parser_and_renderer_use_one_declaration_and_borrow_the_same_ast() {
    let declaration = Declaration::new("shared text");
    let mut syntax = markdown_parser::SyntaxPlugin::new(&declaration);
    syntax.text(|_| Text);

    let mut grammar = markdown_parser::GrammarBuilder::new();
    grammar.add(&syntax).unwrap();

    let parser = markdown_parser::Parser::new(&grammar.build().unwrap());

    let mut rendering = RenderPlugin::new(&declaration);
    rendering
        .on::<Text>(|_, _, _, output| output.push("rendered"))
        .unwrap();

    let mut builder = RenderPresetBuilder::new();
    builder.add(&rendering).unwrap();

    let renderer = Renderer::new(&builder.build().unwrap());
    let document = parser.parse_inline("hello").unwrap();

    assert_eq!(
        renderer
            .render(&document)
            .map_err(|error| error.code())
            .unwrap(),
        "rendered"
    );
    assert_eq!(document.children[0].payload::<Text>(), Some(&Text));
    assert_eq!(document.source, "hello");
}

#[test]
fn captured_configuration_is_shared_and_outlives_the_preset() {
    let calls = Arc::new(AtomicUsize::new(0));
    let weak = Arc::downgrade(&calls);
    let mut plugin = RenderPlugin::new(&Declaration::new("configured"));
    plugin
        .on::<Text>(move |_, _, _, output| {
            output.push(&calls.fetch_add(1, Ordering::Relaxed).to_string())
        })
        .unwrap();

    let mut builder = RenderPresetBuilder::new();
    builder.add(&plugin).unwrap();

    let preset = builder.build().unwrap();
    let first = Renderer::new(&preset);
    let second = Renderer::new(&preset);

    drop(preset);
    drop(plugin);

    assert_eq!(
        first
            .render(&document(Text))
            .map_err(|error| error.code())
            .unwrap(),
        "0"
    );

    // Move an independent renderer to another thread, using the same capture.
    std::thread::spawn(move || {
        assert_eq!(
            second
                .render(&document(Text))
                .map_err(|error| error.code())
                .unwrap(),
            "1"
        );
    })
    .join()
    .unwrap();

    assert!(weak.upgrade().is_some());
    drop(first);

    assert!(weak.upgrade().is_none());
}

#[test]
fn snapshots_are_isolated_and_failed_registration_is_atomic() {
    let mut plugin = RenderPlugin::new(&Declaration::new("first"));
    plugin
        .on::<Text>(|_, _, _, output| output.push("first"))
        .unwrap();

    let registered = plugin.clone();
    let mut builder = RenderPresetBuilder::new();
    let registration = builder.register(&plugin).unwrap();

    let renderer = Renderer::new(&builder.clone().build().unwrap());
    assert!(builder.add(&plugin).is_err());
    assert!(
        plugin
            .on::<Text>(|_, _, _, output| output.push("duplicate"))
            .is_err()
    );

    // A rejected handler does not produce a new snapshot.
    let mut copy = builder.clone();
    copy.remove(&registration).unwrap();

    plugin
        .on::<Other>(|_, _, _, output| output.push("new"))
        .unwrap();

    assert_eq!(builder.registration(&plugin), Some(registration.clone()));
    assert_eq!(
        renderer
            .render(&document(Other))
            .map_err(|error| error.code()),
        Err("unsupported_node")
    );

    builder.remove(&registration).unwrap();
    assert!(builder.remove(&registration).is_err());
    builder.add(&plugin).unwrap();

    assert_eq!(
        Renderer::new(&builder.build().unwrap())
            .render(&document(Other))
            .map_err(|error| error.code())
            .unwrap(),
        "new"
    );

    assert_eq!(
        renderer
            .render(&document(Text))
            .map_err(|error| error.code())
            .unwrap(),
        "first"
    );

    let mut conflict = RenderPlugin::new(&Declaration::new("conflict"));
    conflict
        .on::<Other>(|_, _, _, output| output.push("leaked"))
        .unwrap();
    conflict
        .on::<Text>(|_, _, _, output| output.push("wrong"))
        .unwrap();

    let mut builder = RenderPresetBuilder::new();
    builder.add(&registered).unwrap();
    assert!(builder.add(&conflict).is_err());

    let renderer = Renderer::new(&builder.build().unwrap());
    assert_eq!(
        renderer
            .render(&document(Other))
            .map_err(|error| error.code()),
        Err("unsupported_node")
    );
    assert_eq!(
        renderer
            .render(&document(Text))
            .map_err(|error| error.code())
            .unwrap(),
        "first"
    );
}

#[test]
fn display_name_validation_uses_shared_group_identity() {
    let group = Declaration::group("generic");
    let left = RenderPlugin::new(&group.group("left").plugin("same"));
    let right = RenderPlugin::new(&group.group("right").plugin("same"));
    let mut builder = RenderPresetBuilder::new();
    builder.add(&left).unwrap().add(&right).unwrap();
    assert!(builder.build().is_ok());

    let first = RenderPlugin::new(&group.plugin("same"));
    let second = RenderPlugin::new(&group.plugin("same"));
    let mut builder = RenderPresetBuilder::new();
    builder.add(&first).unwrap().add(&second).unwrap();
    assert!(matches!(
        builder.build().map_err(|error| error.code()),
        Err("duplicate_name")
    ));

    let unrelated = Declaration::group("generic");
    let other = RenderPlugin::new(&unrelated.plugin("other"));
    let mut builder = RenderPresetBuilder::new();
    builder.add(&first).unwrap().add(&other).unwrap();
    assert!(matches!(
        builder.build().map_err(|error| error.code()),
        Err("duplicate_name")
    ));
}
