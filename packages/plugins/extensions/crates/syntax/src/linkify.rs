use markdown_commonmark_contracts::{Link, LinkForm, Text};
use markdown_parser::grammar::SyntaxPlugin;
use markdown_parser::rules::inline::{InlineAction, InlineMatch, InlineRule};
use markdown_parser::{AnyPayload, Node};

mod recognize;

fn inline_rule() -> InlineRule {
    InlineRule::new(b"<", |input, budget| {
        let start = input.position + 1;
        let mut end = start;
        let source = input.source.text();
        while end.get() < source.len() && source.as_bytes()[end.get()] != b'>' {
            budget.spend(1)?;
            if source.as_bytes()[end.get()] <= 32 || source.as_bytes()[end.get()] == b'<' {
                return Ok(None);
            }
            end += 1;
        }
        if end.get() == source.len() {
            return Ok(None);
        }

        let value = &source[start.get()..end.get()];
        let Some(destination) = recognize::destination(value) else {
            return Ok(None);
        };
        Ok(Some(InlineMatch {
            end: end + 1,
            action: InlineAction::Node {
                payload: AnyPayload::new(Link {
                    destination,
                    title: None,
                    form: LinkForm::Autolink,
                }),
                children: vec![Node::leaf(
                    input.source.span_for(start..end)?,
                    Text {
                        value: value.into(),
                    },
                )],
                inhibit_brackets: true,
            },
        }))
    })
    .named("linkify")
}

/// Extends CommonMark autolinks with scheme-less domains inside angle brackets.
/// Bare URLs and email addresses remain text; no TLD allowlist is needed.
pub struct Syntax {
    pub plugin: SyntaxPlugin,
    pub inline: InlineRule,
}
impl Syntax {
    pub fn new() -> Self {
        let inline = inline_rule();
        let mut plugin = SyntaxPlugin::new(&markdown_extensions_contracts::declarations().linkify);
        plugin.add(&inline);
        Self { plugin, inline }
    }
}
impl Default for Syntax {
    fn default() -> Self {
        Self::new()
    }
}
