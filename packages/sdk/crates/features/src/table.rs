use super::*;
use markdown_commonmark_contracts as cm;
use markdown_generic_contracts as ext;
use markdown_trap_contracts as traq;

pub(super) fn definitions() -> Vec<FeatureDefinition> {
    vec![
        FeatureDefinition {
            id: FeatureId::Core,
            export: Export {
                group: "commonmark",
                member: "core",
            },
            declaration: &cm::declarations().plugin,
            payloads: vec![
                Payload::of::<cm::Paragraph>(),
                Payload::of::<cm::Heading>(),
                Payload::of::<cm::Blockquote>(),
                Payload::of::<cm::List>(),
                Payload::of::<cm::ListItem>(),
                Payload::of::<cm::CodeBlock>(),
                Payload::of::<cm::ThematicBreak>(),
                Payload::of::<cm::Text>(),
                Payload::of::<cm::Softbreak>(),
                Payload::of::<cm::Hardbreak>(),
                Payload::of::<cm::InlineCode>(),
                Payload::of::<cm::Emphasis>(),
                Payload::of::<cm::Strong>(),
                Payload::of::<cm::Link>(),
                Payload::of::<cm::Image>(),
            ],
            #[cfg(feature = "syntax")]
            syntax: || &commonmark_syntax().plugin,
            #[cfg(feature = "text")]
            text: Some(|options| {
                markdown_commonmark_text::plugin_with_options(markdown_commonmark_text::Options {
                    explicit_links: options.explicit_links,
                })
            }),
        },
        FeatureDefinition {
            id: FeatureId::Html,
            export: Export {
                group: "commonmark",
                member: "html",
            },
            declaration: &cm::declarations().html,
            payloads: vec![
                Payload::of::<cm::HtmlInline>(),
                Payload::of::<cm::HtmlBlock>(),
            ],
            #[cfg(feature = "syntax")]
            syntax: markdown_commonmark::html::plugin,
            #[cfg(feature = "text")]
            text: Some(|_| markdown_commonmark_text::html::plugin()),
        },
        FeatureDefinition {
            id: FeatureId::Math,
            export: Export {
                group: "generic",
                member: "math",
            },
            declaration: &ext::declarations().math,
            payloads: vec![
                Payload::of::<ext::InlineMath>(),
                Payload::of::<ext::BlockMath>(),
            ],
            #[cfg(feature = "syntax")]
            syntax: markdown_generic_syntax::math::plugin,
            #[cfg(feature = "text")]
            text: Some(|options| {
                markdown_generic_text::math::plugin_with_options(
                    markdown_generic_text::math::Options {
                        style: options.math,
                    },
                )
            }),
        },
        FeatureDefinition {
            id: FeatureId::Mark,
            export: Export {
                group: "generic",
                member: "mark",
            },
            declaration: &ext::declarations().mark,
            payloads: vec![Payload::of::<ext::Mark>()],
            #[cfg(feature = "syntax")]
            syntax: markdown_generic_syntax::mark::plugin,
            #[cfg(feature = "text")]
            text: Some(|_| markdown_generic_text::mark::plugin()),
        },
        FeatureDefinition {
            id: FeatureId::Strikethrough,
            export: Export {
                group: "generic",
                member: "strikethrough",
            },
            declaration: &ext::declarations().strikethrough,
            payloads: vec![Payload::of::<ext::Strikethrough>()],
            #[cfg(feature = "syntax")]
            syntax: markdown_generic_syntax::strikethrough::plugin,
            #[cfg(feature = "text")]
            text: Some(|_| markdown_generic_text::strikethrough::plugin()),
        },
        FeatureDefinition {
            id: FeatureId::Table,
            export: Export {
                group: "generic",
                member: "table",
            },
            declaration: &ext::declarations().table,
            payloads: vec![
                Payload::of::<ext::Table>(),
                Payload::of::<ext::HeaderRow>(),
                Payload::of::<ext::Row>(),
                Payload::of::<ext::Cell>(),
            ],
            #[cfg(feature = "syntax")]
            syntax: markdown_generic_syntax::table::plugin,
            #[cfg(feature = "text")]
            text: Some(|_| markdown_generic_text::table::plugin()),
        },
        FeatureDefinition {
            id: FeatureId::Linkify,
            export: Export {
                group: "generic",
                member: "linkify",
            },
            declaration: &ext::declarations().linkify,
            // Linkify produces the CommonMark Link payload; it owns no new payload.
            payloads: vec![],
            #[cfg(feature = "syntax")]
            syntax: || &crate::traq_linkify_syntax().plugin,
            #[cfg(feature = "text")]
            text: None,
        },
        FeatureDefinition {
            id: FeatureId::Spoiler,
            export: Export {
                group: "trap",
                member: "spoiler",
            },
            declaration: &traq::declarations().spoiler,
            payloads: vec![Payload::of::<traq::Spoiler>()],
            #[cfg(feature = "syntax")]
            syntax: markdown_trap_syntax::spoiler::plugin,
            #[cfg(feature = "text")]
            text: Some(|_| markdown_trap_text::spoiler::plugin()),
        },
        FeatureDefinition {
            id: FeatureId::References,
            export: Export {
                group: "trap",
                member: "references",
            },
            declaration: &traq::declarations().references,
            payloads: vec![
                Payload::of::<traq::Reference>(),
                Payload::of::<traq::Embedding>(),
            ],
            #[cfg(feature = "syntax")]
            syntax: markdown_trap_syntax::references::plugin,
            #[cfg(feature = "text")]
            text: Some(|_| markdown_trap_text::references::plugin()),
        },
        FeatureDefinition {
            id: FeatureId::Stamp,
            export: Export {
                group: "trap",
                member: "stamp",
            },
            declaration: &traq::declarations().stamp,
            payloads: vec![Payload::of::<traq::Stamp>()],
            #[cfg(feature = "syntax")]
            syntax: markdown_trap_syntax::stamp::plugin,
            #[cfg(feature = "text")]
            text: Some(|_| markdown_trap_text::stamp::plugin()),
        },
        FeatureDefinition {
            id: FeatureId::Spacing,
            export: Export {
                group: "trap",
                member: "spacing",
            },
            declaration: &traq::declarations().spacing,
            payloads: vec![Payload::of::<traq::BlankLine>()],
            #[cfg(feature = "syntax")]
            syntax: markdown_trap_syntax::spacing::plugin,
            #[cfg(feature = "text")]
            text: Some(|_| markdown_trap_text::spacing::plugin()),
        },
    ]
}
