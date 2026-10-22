use markdown_commonmark_contracts::LinkForm;

mod path;
mod recognize;

use markdown_parser::{
    Node, NodeKind,
    engine::{
        Plugin,
        inline::{InlineAction, InlineMatch, InlineRule, TextMatch, TextRule},
    },
};

fn inline_rule(recognizer: std::sync::Arc<recognize::Recognizer>) -> InlineRule {
    InlineRule::new(b"hHfF", move |input, budget| {
        if input.inside_brackets {
            return Ok(None);
        }

        let tail = input.tail();
        let scheme = ["http://", "https://", "ftp://"].iter().any(|prefix| {
            tail.get(..prefix.len())
                .is_some_and(|s| s.eq_ignore_ascii_case(prefix))
        });

        if !scheme {
            return Ok(None);
        }

        // A URL cannot cross whitespace or a control character. Charge only
        // the candidate token inspected by the recognizer.
        let scan_len = recognize::scan_len(tail);
        budget.spend(scan_len)?;
        let Some(found) = recognizer.at(input.source.text(), input.position.get(), scan_len) else {
            return Ok(None);
        };

        let range = input.source.range(found.start..found.end)?;
        let span = input.source.span_for(range.clone())?;
        Ok(Some(InlineMatch {
            end: range.end,
            action: InlineAction::Node {
                kind: NodeKind::new(markdown_commonmark_contracts::Link {
                    destination: found.destination,
                    title: None,
                    form: LinkForm::Linkify,
                }),
                children: vec![Node::leaf(
                    span,
                    markdown_commonmark_contracts::Text { value: found.label },
                )],
                inhibit_brackets: false,
            },
        }))
    })
    .named("linkify")
}

fn text_rule(recognizer: std::sync::Arc<recognize::Recognizer>) -> TextRule {
    TextRule::new(move |input, _| {
        recognizer
            .find(input.text())
            .into_iter()
            .filter(|found| !(input.after_decoded_text && found.start == 0))
            .map(|found| {
                let start = input.range.start + found.start;
                let end = input.range.start + found.end;

                Ok(TextMatch {
                    start,
                    end,
                    kind: NodeKind::new(markdown_commonmark_contracts::Link {
                        destination: found.destination,
                        title: None,
                        form: LinkForm::Linkify,
                    }),
                    children: vec![Node::leaf(
                        input.source.span_for(start..end)?,
                        markdown_commonmark_contracts::Text { value: found.label },
                    )],
                })
            })
            .collect()
    })
    .named("linkify")
}

/// A reusable recognizer and its typed grammar anchors. Product profiles supply
/// the accepted top-level-domain pattern; this crate does not consult DNS.
pub struct Syntax {
    pub plugin: Plugin,
    pub inline: InlineRule,
    pub text: TextRule,
}
impl Syntax {
    pub fn new(tld_pattern: &str) -> Result<Self, regex::Error> {
        let recognizer = std::sync::Arc::new(recognize::Recognizer::new(tld_pattern)?);
        let inline = inline_rule(recognizer.clone());
        let text = text_rule(recognizer);
        let mut plugin = Plugin::new(&markdown_extensions_contracts::declarations().linkify);
        plugin.add(&inline);
        plugin.add(&text);
        Ok(Self {
            plugin,
            inline,
            text,
        })
    }
}
