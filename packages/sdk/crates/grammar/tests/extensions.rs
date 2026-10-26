use markdown_commonmark_contracts::Link;
use markdown_definitions::PluginDeclaration as Declaration;
use markdown_parser::NodeData;
use markdown_parser::NodeRole;
use markdown_parser::Parser;
use markdown_parser::SyntaxPlugin;
use markdown_parser::rules::block::BlockRule;
use markdown_parser::rules::inline::InlineMatch;
use markdown_parser::rules::inline::InlineRule;
use markdown_parser::rules::inline::TextMatch;
use markdown_parser::rules::inline::TextRule;
use traq_markdown_grammar::presets;

#[derive(Debug, Clone, PartialEq)]
struct BlockNote {
    title: String,
}
impl NodeData for BlockNote {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure {
            role: NodeRole::Block,
            children: markdown_ast::ChildStructure::Any,
        };
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        self.title.len()
    }
}

#[derive(Debug, Clone, PartialEq)]
struct InlineNote {
    title: String,
}
impl NodeData for InlineNote {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure {
            role: NodeRole::Inline,
            children: markdown_ast::ChildStructure::Any,
        };
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize {
        self.title.len()
    }
}

fn has_link(nodes: &[markdown_parser::Node]) -> bool {
    nodes.iter().any(|node| {
        node.payload::<Link>()
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
        while end < input.lines.end() && input.line(end) != ":::" {
            budget.spend(input.line(end).len() + 1)?;
            end += 1;
        }
        if end == input.lines.end() {
            return Ok(None);
        }
        Ok(Some(
            input.blocks(
                end + 1,
                BlockNote {
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
            InlineNote {
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
            payload: InlineNote {
                title: "text".into(),
            }
            .into(),
            children: vec![],
        }])
    })
}

fn note() -> (SyntaxPlugin, BlockRule) {
    let block = note_block();
    let mut plugin = SyntaxPlugin::new(&Declaration::group("test").plugin("note"));
    plugin.add(&block);
    plugin.add(note_inline());
    plugin.add(note_text());
    (plugin, block)
}

fn count(nodes: &[markdown_parser::Node]) -> usize {
    nodes
        .iter()
        .map(|n| {
            usize::from(n.payload::<BlockNote>().is_some() || n.payload::<InlineNote>().is_some())
                + count(&n.children)
        })
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
    let registration = builder.register(&plugin).unwrap();
    builder.remove(&registration).unwrap();
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
