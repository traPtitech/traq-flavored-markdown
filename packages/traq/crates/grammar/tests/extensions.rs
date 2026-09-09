use markdown_commonmark_contracts::Link;
use markdown_definitions::Plugin as Declaration;
use markdown_parser::{
    NodeData, Parser, Plugin,
    engine::{
        block::BlockRule,
        inline::{InlineMatch, InlineRule, TextMatch, TextRule},
    },
};
use traq_markdown_grammar::presets;

#[derive(Debug, Clone, PartialEq)]
struct Note {
    title: String,
}
impl NodeData for Note {}

fn has_link(nodes: &[markdown_parser::Node]) -> bool {
    nodes.iter().any(|node| {
        node.get::<Link>()
            .is_some_and(|link| link.destination == "/later")
            || has_link(&node.children)
    })
}

fn note_block() -> BlockRule {
    BlockRule::new(|input, budget| {
        let Some(title) = input.current().strip_prefix(":::note ") else {
            return Ok(None);
        };
        let mut end = input.start + 1;
        while end < input.lines.len() && input.line(end) != ":::" {
            budget.spend(input.line(end).len() + 1)?;
            end += 1;
        }
        if end == input.lines.len() {
            return Ok(None);
        }
        Ok(Some(
            input.blocks(
                end + 1,
                Note {
                    title: title.into(),
                }
                .into(),
                input.start + 1..end,
            )?,
        ))
    })
    .interrupts(|probe| probe.line.starts_with(":::note "))
}

fn note_inline() -> InlineRule {
    InlineRule::new(b"~", |input, _| {
        if !input.tail().starts_with("~note~") {
            return Ok(None);
        }
        Ok(Some(InlineMatch::leaf(
            input.position + 6,
            Note {
                title: "inline".into(),
            }
            .into(),
        )))
    })
}

fn note_text() -> TextRule {
    TextRule::new(|input, _| {
        let Some(offset) = input.text().find("NOTE") else {
            return Ok(vec![]);
        };
        Ok(vec![TextMatch {
            start: input.range.start + offset,
            end: input.range.start + offset + 4,
            kind: Note {
                title: "text".into(),
            }
            .into(),
            children: vec![],
        }])
    })
}

fn note() -> (Plugin, BlockRule) {
    let block = note_block();
    let mut plugin = Plugin::new(&Declaration::group("test").new("note"));
    plugin.add(&block);
    plugin.add(note_inline());
    plugin.add(note_text());
    (plugin, block)
}

fn count(nodes: &[markdown_parser::Node]) -> usize {
    nodes
        .iter()
        .map(|n| usize::from(n.get::<Note>().is_some()) + count(&n.children))
        .sum()
}

#[test]
fn block_bodies_resolve_nested_and_later_references() {
    let (plugin, block) = note();
    let mut builder = presets::commonmark::builder();
    builder
        .add(&plugin)
        .unwrap()
        .before(&block, &presets::commonmark::syntax().block.paragraph)
        .unwrap();
    let grammar = builder.build().unwrap();
    let parser = Parser::new(&grammar);
    for source in [
        "before\n:::note A\n[one][r]\n:::\n\n[r]: /later\n",
        "> :::note A\n> [one][r]\n> :::\n\n[r]: /later\n",
        "- :::note A\n  [one][r]\n\n  [r]: /later\n  :::\n\n[outside][r]\n",
        ":::note A\n\tcode\n\n[one][r]\n:::\n\n[r]: /later\n",
        ":::note empty\n:::\n",
    ] {
        let doc = parser.parse(source).unwrap();
        assert!(count(&doc.children) > 0);

        if source.contains("[one]") {
            assert!(has_link(&doc.children))
        }
    }
}

#[test]
fn removal_covers_every_phase_and_presets_do_not_leak() {
    let (plugin, block) = note();
    let source = "before\n:::note A\n~note~ NOTE\n:::\n";
    let mut builder = presets::commonmark::builder();
    builder
        .add(&plugin)
        .unwrap()
        .before(&block, &presets::commonmark::syntax().block.paragraph)
        .unwrap();
    let enabled = builder.build().unwrap();
    let mut builder = presets::commonmark::builder();
    builder.add(&plugin).unwrap().remove(&plugin).unwrap();
    let disabled = builder.build().unwrap();
    for _ in 0..3 {
        assert_eq!(
            count(&Parser::new(&enabled).parse(source).unwrap().children),
            3
        );
        assert_eq!(
            Parser::new(&disabled).parse(source).unwrap(),
            presets::commonmark::parser().parse(source).unwrap()
        );
    }
}
