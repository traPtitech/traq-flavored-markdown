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

pub fn inline_rule() -> &'static InlineRule {
    static RULE: std::sync::LazyLock<InlineRule> = std::sync::LazyLock::new(|| {
        InlineRule::new(b"hHfF", |input, budget| {
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
            let Some(found) = recognize::at(input.source.text(), input.position, scan_len) else {
                return Ok(None);
            };

            let span = input.source.span_for(found.start..found.end)?;
            Ok(Some(InlineMatch {
                end: found.end,
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
    });
    &RULE
}

pub fn text_rule() -> &'static TextRule {
    static RULE: std::sync::LazyLock<TextRule> = std::sync::LazyLock::new(|| {
        TextRule::new(|input, _| {
            recognize::find(input.text())
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
    });
    &RULE
}

pub fn plugin() -> &'static Plugin {
    static PLUGIN: std::sync::LazyLock<Plugin> = std::sync::LazyLock::new(|| {
        let mut plugin = Plugin::new(&markdown_generic_contracts::preset().linkify);
        plugin.add(inline_rule());
        plugin.add(text_rule());
        plugin
    });
    &PLUGIN
}
