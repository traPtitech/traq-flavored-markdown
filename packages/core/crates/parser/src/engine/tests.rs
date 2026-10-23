use super::{BuildError, GrammarBuilder, Parser, SyntaxPlugin};
use markdown_ast::{NodeData, NodeRole};
use markdown_definitions::PluginDeclaration as Declaration;

// Native grammar construction must not require serde, WireTypeKey, or codec setup.
#[derive(Clone, Debug, PartialEq)]
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

fn grammar_plugin(declaration: &Declaration) -> SyntaxPlugin {
    let mut plugin = SyntaxPlugin::new(declaration);

    plugin.text(Text);
    plugin
}

#[test]
fn shared_declaration_hierarchy_survives_its_original_owners() {
    let root = Declaration::group("generic");
    let nested = root.group("github");
    let declaration = nested.plugin("links");
    let plugin = grammar_plugin(&declaration);

    assert_eq!(plugin.namespace(), declaration.namespace());
    drop(declaration);
    drop(nested);
    drop(root);

    let mut builder = GrammarBuilder::new();
    builder.add(&plugin).unwrap();

    let grammar = builder.build().unwrap();
    assert!(grammar.describe().contains("generic/github/links"));

    let doc = Parser::new(&grammar).parse_inline("ordinary text").unwrap();

    assert_eq!(
        doc.children[0].payload::<Text>(),
        Some(&Text("ordinary text".into()))
    );
}

#[test]
fn duplicate_checks_use_the_selected_shared_namespaces() {
    let root = Declaration::group("generic");
    let base = grammar_plugin(&root.plugin("base"));
    let mut builder = GrammarBuilder::new();

    builder.add(&base).unwrap();

    assert!(matches!(
        builder.add(&base),
        Err(BuildError::Duplicate { .. })
    ));

    let duplicate = SyntaxPlugin::new(&root.plugin("base"));
    let mut duplicate_names = builder.clone();

    duplicate_names.add(&duplicate).unwrap();

    assert!(matches!(
        duplicate_names.build(),
        Err(BuildError::DuplicateName { .. })
    ));

    // Same display name under distinct parent groups is allowed.
    let nested = root.group("nested");
    builder
        .add(&SyntaxPlugin::new(&nested.plugin("base")))
        .unwrap();
    assert!(builder.clone().build().is_ok());

    // A separate, identically named root is a different symbol, and conflicts
    // only once it is actually included in the composition.
    let other = Declaration::group("generic");
    assert!(builder.clone().build().is_ok());
    builder
        .add(&SyntaxPlugin::new(&other.plugin("another")))
        .unwrap();

    assert!(matches!(
        builder.build(),
        Err(BuildError::DuplicateName { .. })
    ));
}
