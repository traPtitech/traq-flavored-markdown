use markdown_definitions::Plugin as Declaration;
use markdown_parser::{
    BuildError, GrammarBuilder, NodeData, NodeRole, Parser, Plugin, engine::inline::InlineRule,
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
fn plugin() -> Plugin {
    let mut plugin = Plugin::new(&Declaration::new("text"));
    plugin.text(Text);
    plugin
}

#[test]
fn mutation_and_rejected_changes_preserve_existing_snapshots() {
    let mut plugin = plugin();
    let rule = InlineRule::new(b"x", |input, _| {
        Ok(Some(markdown_parser::engine::inline::InlineMatch::literal(
            input.position + 1,
        )))
    });

    plugin.add(&rule);

    let mut builder = GrammarBuilder::new();
    let registration = builder.register(&plugin).unwrap();

    let original = builder.clone().build().unwrap();
    let mut duplicate = Plugin::new(&Declaration::new("duplicate"));
    duplicate.add(&rule);
    assert!(builder.add(&duplicate).is_err());

    let missing = InlineRule::new(b"x", |_, _| Ok(None));
    assert!(builder.before(&rule, &missing).is_err());

    assert_eq!(
        builder.clone().build().unwrap().describe(),
        original.describe()
    );

    plugin.add(InlineRule::new(b"y", |input, _| {
        Ok(Some(markdown_parser::engine::inline::InlineMatch::text(
            input.position + 1,
            "changed".into(),
        )))
    }));

    assert_eq!(builder.registration(&plugin), Some(registration.clone()));
    let mut removable = builder.clone();
    removable.remove(&registration).unwrap();
    assert!(removable.remove(&registration).is_err());

    let parser = Parser::new(&builder.build().unwrap());

    drop(original);

    assert_eq!(
        parser.parse_inline("y").unwrap().children[0].get::<Text>(),
        Some(&Text("y".into()))
    );
}

#[test]
fn rule_names_are_checked_per_plugin_and_phase() {
    for (named, expected_error) in [(true, true), (false, false)] {
        let mut plugin = plugin();
        for marker in [b"x" as &'static [u8], b"y"] {
            let rule = InlineRule::new(marker, |_, _| Ok(None));
            plugin.add(if named { rule.named("rule") } else { rule });
        }

        let mut builder = GrammarBuilder::new();
        builder.add(&plugin).unwrap();

        assert_eq!(
            matches!(builder.build(), Err(BuildError::DuplicateName { .. })),
            expected_error
        );
    }
}

#[test]
fn shared_name_checks_keep_parser_diagnostics_and_rule_error_priority() {
    let root = Declaration::group("generic");
    let nested = root.group("nested");
    let first = Plugin::new(&nested.plugin("same"));
    let mut second = Plugin::new(&nested.plugin("same"));

    for rule_collision in [false, true] {
        if rule_collision {
            for marker in [b"a" as &'static [u8], b"b"] {
                second.add(InlineRule::new(marker, |_, _| Ok(None)).named("rule"));
            }
        }

        let mut builder = GrammarBuilder::new();

        builder
            .add(&plugin())
            .unwrap()
            .add(&first)
            .unwrap()
            .add(&second)
            .unwrap();

        let expected = if rule_collision {
            BuildError::DuplicateName {
                scope: "generic/nested/same / inline".into(),
                name: "rule".into(),
            }
        } else {
            BuildError::DuplicateName {
                scope: "generic/nested".into(),
                name: "same".into(),
            }
        };

        assert!(matches!(builder.build(), Err(error) if error == expected));
    }
}

#[test]
fn text_and_block_context_capabilities_can_be_composed_independently() {
    use markdown_parser::engine::{
        ParseState,
        block::{BlockInput, BlockPolicy, LineIndex},
    };
    struct Preserve;
    impl BlockPolicy for Preserve {
        fn after_match(
            &self,
            _: &BlockInput<'_>,
            end: LineIndex,
            _: &mut ParseState,
        ) -> Result<LineIndex, markdown_parser::ParseError> {
            Ok(end)
        }
    }
    let mut source = plugin();
    source.block_policy(Preserve);
    let mut text = Plugin::new(&Declaration::new("text-only"));
    text.inherit_text_from(&source).unwrap();
    let mut blocks = Plugin::new(&Declaration::new("blocks-only"));
    blocks.inherit_block_policy_from(&source).unwrap();
    let mut builder = GrammarBuilder::new();
    builder.add(&text).unwrap().add(&blocks).unwrap();
    let document = Parser::new(&builder.build().unwrap())
        .parse_inline("text")
        .unwrap();
    assert_eq!(
        document.children[0].get::<Text>(),
        Some(&Text("text".into()))
    );

    assert!(text.inherit_text_from(&source).is_err());
    assert!(blocks.inherit_block_policy_from(&source).is_err());
    let empty = Plugin::new(&Declaration::new("no-context"));
    assert!(blocks.inherit_text_from(&empty).is_err());
    assert!(text.inherit_block_policy_from(&empty).is_err());
}
