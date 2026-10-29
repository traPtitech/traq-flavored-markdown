use markdown_commonmark_contracts::{Link, LinkForm, Text};
use markdown_parser::grammar::SyntaxPlugin;
use markdown_parser::rules::inline::{InlineAction, InlineMatch, InlineRule, TextMatch, TextRule};
use markdown_parser::{AnyPayload, Node};

mod path;
mod recognize;

fn inline_rule() -> InlineRule {
    InlineRule::new(b"<hHfF/", |input, budget| {
        if !input.tail().starts_with('<') {
            if input.inside_brackets
                || !["http://", "https://", "ftp://", "//"]
                    .iter()
                    .any(|prefix| {
                        input
                            .tail()
                            .get(..prefix.len())
                            .is_some_and(|value| value.eq_ignore_ascii_case(prefix))
                    })
            {
                return Ok(None);
            }
            let length = recognize::scan_len(input.tail());
            budget.spend(length)?;
            let Some(found) = recognize::bare_at(input.source.text(), input.position.get(), length)
            else {
                return Ok(None);
            };
            let range = input.source.range(found.start..found.end)?;
            let span = input.source.span_for(range.clone())?;
            return Ok(Some(InlineMatch {
                end: range.end,
                action: InlineAction::Node {
                    payload: AnyPayload::new(Link {
                        destination: found.destination,
                        title: None,
                        form: LinkForm::Linkify,
                    }),
                    children: vec![Node::leaf(span, Text { value: found.label })],
                    inhibit_brackets: false,
                },
            }));
        }
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

fn text_rule() -> TextRule {
    TextRule::new(|input, _| {
        recognize::bare_urls(input.text())
            .into_iter()
            .filter(|found| !(input.after_decoded_text && found.start == 0))
            .map(|found| {
                let start = input.range.start + found.start;
                let end = input.range.start + found.end;
                Ok(TextMatch {
                    start,
                    end,
                    payload: AnyPayload::new(Link {
                        destination: found.destination,
                        title: None,
                        form: LinkForm::Linkify,
                    }),
                    children: vec![Node::leaf(
                        input.source.span_for(start..end)?,
                        Text { value: found.label },
                    )],
                })
            })
            .collect()
    })
    .named("linkify")
}

/// Linkifies scheme URLs, scheme-relative URLs and email addresses, and extends
/// angle autolinks with scheme-less domains. Bare domains remain text.
pub struct Syntax {
    pub plugin: SyntaxPlugin,
    pub inline: InlineRule,
    pub text: TextRule,
}
impl Syntax {
    pub fn new() -> Self {
        let inline = inline_rule();
        let text = text_rule();
        let mut plugin = SyntaxPlugin::new(&markdown_extensions_contracts::declarations().linkify);
        plugin.add(&inline);
        plugin.add(&text);
        Self {
            plugin,
            inline,
            text,
        }
    }
}
impl Default for Syntax {
    fn default() -> Self {
        Self::new()
    }
}
