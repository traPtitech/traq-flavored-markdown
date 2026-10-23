use markdown_definitions::Plugin as Declaration;
use markdown_parser::{
    GrammarBuilder, Limits, Node, NodeData, NodeRole, ParseError, Parser, Plugin, Span,
    ValidationLimits,
    engine::{
        block::{BlockMatch, BlockRule, DraftContent},
        inline::{InlineAction, InlineMatch, InlineRule},
    },
};

#[derive(Default)]
struct CustomState(Option<String>);

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

fn plugin() -> Plugin {
    let mut plugin = Plugin::new(&Declaration::new("test"));
    plugin.text(Text);
    plugin
}

fn parser(plugin: &Plugin) -> Parser {
    let mut builder = GrammarBuilder::new();
    builder.add(plugin).unwrap();
    Parser::new(&builder.build().unwrap())
}

#[test]
fn invalid_plugin_results_never_return_partial_documents() {
    for case in 0..5 {
        let mut plugin = plugin();
        plugin.add(InlineRule::new(b"", move |input, _| {
            let start = input.position;
            let action = match case {
                0 => InlineMatch::literal(start),
                1 => InlineMatch::literal(start + 1),
                2 => InlineMatch::literal(start + 99),
                3 => InlineMatch::leaf(start + 3, Invalid.into()),
                _ => InlineMatch {
                    end: start + 3,
                    action: InlineAction::Node {
                        kind: Text("parent".into()).into(),
                        inhibit_brackets: false,
                        children: vec![Node::leaf(
                            Span { start: 1, end: 2 },
                            Text("bad span".into()),
                        )],
                    },
                },
            };
            Ok(Some(action))
        }));

        assert!(matches!(
            parser(&plugin).parse_inline("日"),
            Err(ParseError::InvalidRuleOutput { .. } | ParseError::InvalidDocument(_))
        ));
    }
}

#[test]
fn malformed_rule_results_report_the_rule_phase_source_position_and_cause() {
    use markdown_parser::engine::ParsePhase;
    let mut implementation = plugin();
    implementation.add(
        InlineRule::new(b"!", |input, _| {
            Ok(Some(InlineMatch::literal(input.position)))
        })
        .named("stuck"),
    );
    let error = parser(&implementation).parse_inline("日\r\n!").unwrap_err();
    assert!(
        matches!(error, ParseError::InvalidRuleOutput { phase: ParsePhase::Inline, rule: Some(ref name), position: 5, ref reason }
        if name == "stuck" && reason.contains("must advance")),
        "{error:?}"
    );

    let mut implementation = plugin();
    implementation.add(
        BlockRule::new(|input, _| Ok(Some(BlockMatch::ignore(input.start)))).named("empty-block"),
    );
    let error = parser(&implementation).parse("text").unwrap_err();
    assert!(
        matches!(error, ParseError::InvalidRuleOutput { phase: ParsePhase::Block, rule: Some(ref name), position: 0, ref reason }
        if name == "empty-block" && reason.contains("must advance")),
        "{error:?}"
    );
}

#[test]
fn invalid_payload_diagnostics_keep_the_original_tree_location() {
    let mut plugin = plugin();
    plugin.add(
        InlineRule::new(b"!", |input, _| {
            Ok(Some(InlineMatch::leaf(input.position + 1, Invalid.into())))
        })
        .named("invalid-payload"),
    );
    let error = parser(&plugin).parse_inline("日!").unwrap_err();
    assert!(
        matches!(error, ParseError::InvalidDocument(ref cause)
        if cause.path == [1] && cause.span == Some(Span { start: 3, end: 4 }) && cause.payload_type.unwrap().ends_with("Invalid") && cause.payload.as_ref().unwrap().expected == "custom payload invariant"),
        "{error:?}"
    );
}

#[test]
fn unsuccessful_rules_still_consume_the_work_budget() {
    let mut plugin = plugin();

    plugin.add(InlineRule::new(b"", |_, budget| {
        budget.spend(10)?;
        Ok(None)
    }));

    let parser = parser(&plugin).with_limits(Limits {
        work: 5,
        ..Limits::default()
    });

    assert!(matches!(parser.parse_inline("x"),
        Err(ParseError::ResourceLimit { resource }) if resource.as_str() == "work"));
}

#[test]
fn rule_dispatch_and_accepted_cursor_moves_charge_work_automatically() {
    let mut rejected = plugin();
    rejected.add(InlineRule::new(b"x", |_, _| Ok(None)));
    assert!(
        matches!(parser(&rejected).with_limits(Limits { work: 1, ..Limits::default() }).parse_inline("x"),
        Err(ParseError::ResourceLimit { resource }) if resource.as_str() == "work")
    );

    let mut accepted = plugin();
    accepted.add(InlineRule::new(b"a", |input, _| {
        Ok(Some(InlineMatch::leaf(
            input.source.offset(input.source.text().len())?,
            Text("node".into()).into(),
        )))
    }));
    assert!(
        matches!(parser(&accepted).with_limits(Limits { work: 9, ..Limits::default() }).parse_inline("abcdefgh"),
        Err(ParseError::ResourceLimit { resource }) if resource.as_str() == "work")
    );
}

#[test]
fn parser_charges_plugin_owned_payload_bytes() {
    let plugin = plugin();
    let parser = parser(&plugin).with_limits(Limits {
        document: ValidationLimits {
            payload_bytes: 2,
            ..ValidationLimits::default()
        },
        ..Limits::default()
    });
    assert!(matches!(
        parser.parse_inline("abc"),
        Err(ParseError::ResourceLimit { resource }) if resource.as_str() == "payload_bytes"
    ));
}

#[test]
fn source_helpers_reject_invalid_ranges() {
    for mode in 0..3 {
        let mut plugin = plugin();
        plugin.add(BlockRule::new(move |input, _| match mode {
            0 => input
                .leaf(input.start, Text(String::new()).into())
                .map(Some),
            1 => input
                .blocks(
                    input.lines.end() + 1,
                    Text(String::new()).into(),
                    input.start..input.start,
                )
                .map(Some),
            _ => input
                .blocks(
                    markdown_parser::engine::block::LineIndex::new(1),
                    Text(String::new()).into(),
                    markdown_parser::engine::block::LineIndex::new(0)
                        ..markdown_parser::engine::block::LineIndex::new(99),
                )
                .map(Some),
        }));

        assert!(matches!(
            parser(&plugin).parse("text"),
            Err(ParseError::InvalidRuleOutput { .. })
        ));
    }
}

#[test]
fn accepted_block_matches_share_parse_scoped_state_with_inline_rules() {
    let mut plugin = plugin();

    plugin.add(BlockRule::new(|input, _| {
        if let Some(value) = input.current().strip_prefix("def:") {
            let value = value.to_owned();
            return Ok(Some(BlockMatch::ignore(input.start + 1).on_accept(
                move |state, _| {
                    state.get_or_default::<CustomState>().0.get_or_insert(value);
                    Ok(())
                },
            )));
        }

        Ok(Some(input.matched(
            input.start + 1,
            Text("container".into()).into(),
            DraftContent::Inline(input.body(input.start..input.start + 1)?),
        )?))
    }));

    plugin.add(InlineRule::new(b"x", |input, _| {
        let value = input
            .state::<CustomState>()
            .and_then(|state| state.0.clone())
            .unwrap_or_else(|| "missing".into());
        Ok(Some(InlineMatch::leaf(
            input.position + 1,
            Text(value).into(),
        )))
    }));

    let parser = parser(&plugin);
    let with_definition = parser.parse("x\ndef:found").unwrap();
    assert_eq!(
        with_definition.children[0].children[0].get::<Text>(),
        Some(&Text("found".into()))
    );

    let without_definition = parser.parse("x").unwrap();
    assert_eq!(
        without_definition.children[0].children[0].get::<Text>(),
        Some(&Text("missing".into()))
    );
}

#[test]
fn rejected_block_matches_do_not_commit_state() {
    use std::sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    };

    let commits = Arc::new(AtomicUsize::new(0));
    let mut plugin = plugin();
    plugin.add(BlockRule::new({
        let commits = Arc::clone(&commits);
        move |input, _| {
            let commits = Arc::clone(&commits);
            Ok(Some(BlockMatch::ignore(input.start).on_accept(
                move |_, _| {
                    commits.fetch_add(1, Ordering::Relaxed);
                    Ok(())
                },
            )))
        }
    }));

    assert!(matches!(
        parser(&plugin).parse("x"),
        Err(ParseError::InvalidRuleOutput { .. })
    ));
    assert_eq!(commits.load(Ordering::Relaxed), 0);
}

#[test]
fn accepted_block_commits_obey_the_work_budget() {
    let mut plugin = plugin();
    plugin.add(BlockRule::new(|input, _| {
        Ok(Some(
            BlockMatch::ignore(input.start + 1).on_accept(|_, budget| budget.spend(10)),
        ))
    }));

    let result = parser(&plugin)
        .with_limits(Limits {
            work: 5,
            ..Limits::default()
        })
        .parse("x");

    assert!(
        matches!(result, Err(ParseError::ResourceLimit { resource }) if resource.as_str() == "work")
    );
}

#[test]
fn final_validation_stops_at_the_remaining_work_budget() {
    use std::sync::atomic::{AtomicUsize, Ordering};

    static CHECKS: AtomicUsize = AtomicUsize::new(0);
    #[derive(Clone, Debug, PartialEq)]
    struct Counted;

    impl NodeData for Counted {
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
            let valid = {
                CHECKS.fetch_add(1, Ordering::Relaxed);
                true
            };
            if valid {
                Ok(())
            } else {
                Err(markdown_ast::PayloadError::new("custom payload invariant"))
            }
        }
    }

    let mut plugin = plugin();

    plugin.add(InlineRule::new(b"x", |input, _| {
        Ok(Some(InlineMatch {
            end: input.position + 1,
            action: InlineAction::Node {
                kind: Text("parent".into()).into(),
                inhibit_brackets: false,
                children: (0..30)
                    .map(|_| Node::leaf(Span { start: 0, end: 0 }, Counted))
                    .collect(),
            },
        }))
    }));

    let result = parser(&plugin)
        .with_limits(Limits {
            work: 20,
            ..Limits::default()
        })
        .parse_inline("x");

    assert!(
        matches!(result, Err(ParseError::ResourceLimit { resource }) if resource.as_str() == "work")
    );
    assert!(CHECKS.load(Ordering::Relaxed) <= 20);
    CHECKS.store(0, Ordering::Relaxed);

    assert!(
        parser(&plugin)
            .with_limits(Limits {
                work: 100,
                ..Limits::default()
            })
            .parse_inline("x")
            .is_ok()
    );

    assert_eq!(CHECKS.load(Ordering::Relaxed), 30);
}
