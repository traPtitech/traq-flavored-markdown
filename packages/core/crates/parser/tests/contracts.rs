use markdown_definitions::Plugin as Declaration;
use markdown_parser::{
    GrammarBuilder, Limits, Node, NodeData, ParseError, Parser, Plugin, Span,
    engine::{
        block::BlockRule,
        inline::{InlineAction, InlineMatch, InlineRule},
    },
};

#[derive(Debug, Clone, PartialEq)]
struct Text(String);
impl NodeData for Text {}

#[derive(Debug, Clone, PartialEq)]
struct Invalid;
impl NodeData for Invalid {
    fn validate(&self, _: &[Node]) -> bool {
        false
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
    for action in [
        InlineMatch::literal(0),
        InlineMatch::literal(1),
        InlineMatch::literal(99),
        InlineMatch::leaf(3, Invalid.into()),
        InlineMatch {
            end: 3,
            action: InlineAction::Node {
                kind: Text("parent".into()).into(),
                inhibit_brackets: false,
                children: vec![Node::leaf(
                    Span { start: 1, end: 2 },
                    Text("bad span".into()),
                )],
            },
        },
    ] {
        let action = std::sync::Mutex::new(Some(action));
        let mut plugin = plugin();

        plugin.add(InlineRule::new(b"", move |_, _| {
            Ok(action.lock().unwrap().take())
        }));

        assert_eq!(
            parser(&plugin).parse_inline("日"),
            Err(ParseError::InternalError)
        );
    }
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
        Err(ParseError::ResourceLimit { resource }) if resource == "work"));
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
                .blocks(input.lines.len() + 1, Text(String::new()).into(), 0..0)
                .map(Some),
            _ => input.blocks(1, Text(String::new()).into(), 0..99).map(Some),
        }));

        assert_eq!(
            parser(&plugin).parse("text"),
            Err(ParseError::InternalError)
        );
    }
}

#[test]
fn final_validation_stops_at_the_remaining_work_budget() {
    use std::sync::atomic::{AtomicUsize, Ordering};

    static CHECKS: AtomicUsize = AtomicUsize::new(0);
    #[derive(Clone, Debug, PartialEq)]
    struct Counted;

    impl NodeData for Counted {
        fn validate(&self, _: &[Node]) -> bool {
            CHECKS.fetch_add(1, Ordering::Relaxed);
            true
        }
    }

    let mut plugin = plugin();

    plugin.add(InlineRule::new(b"x", |_, _| {
        Ok(Some(InlineMatch {
            end: 1,
            action: InlineAction::Node {
                kind: Text("parent".into()).into(),
                inhibit_brackets: false,
                children: (0..30)
                    .map(|_| Node::leaf(Span { start: 0, end: 1 }, Counted))
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

    assert!(matches!(result, Err(ParseError::ResourceLimit { resource }) if resource == "work"));
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
