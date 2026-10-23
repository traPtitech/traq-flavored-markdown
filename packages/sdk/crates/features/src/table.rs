use super::*;
use markdown_commonmark_contracts as cm;
use markdown_extensions_contracts as ext;
use markdown_trap_contracts as traq;

pub(super) fn definitions() -> Vec<FeatureDefinition> {
    vec![
        FeatureDefinition {
            id: FeatureId::Core,
            export: Export {
                group: "commonmark",
                member: "core",
            },
            contract: cm::Feature::Core.contract(),
            #[cfg(feature = "syntax")]
            syntax: || &commonmark_syntax().plugin,
        },
        FeatureDefinition {
            id: FeatureId::Html,
            export: Export {
                group: "commonmark",
                member: "html",
            },
            contract: cm::Feature::Html.contract(),
            #[cfg(feature = "syntax")]
            syntax: markdown_commonmark::html::plugin,
        },
        FeatureDefinition {
            id: FeatureId::Math,
            export: Export {
                group: "extensions",
                member: "math",
            },
            contract: ext::Feature::Math.contract(),
            #[cfg(feature = "syntax")]
            syntax: markdown_extensions_syntax::math::plugin,
        },
        FeatureDefinition {
            id: FeatureId::Mark,
            export: Export {
                group: "extensions",
                member: "mark",
            },
            contract: ext::Feature::Mark.contract(),
            #[cfg(feature = "syntax")]
            syntax: markdown_extensions_syntax::mark::plugin,
        },
        FeatureDefinition {
            id: FeatureId::Strikethrough,
            export: Export {
                group: "extensions",
                member: "strikethrough",
            },
            contract: ext::Feature::Strikethrough.contract(),
            #[cfg(feature = "syntax")]
            syntax: markdown_extensions_syntax::strikethrough::plugin,
        },
        FeatureDefinition {
            id: FeatureId::Table,
            export: Export {
                group: "extensions",
                member: "table",
            },
            contract: ext::Feature::Table.contract(),
            #[cfg(feature = "syntax")]
            syntax: markdown_extensions_syntax::table::plugin,
        },
        FeatureDefinition {
            id: FeatureId::Linkify,
            export: Export {
                group: "extensions",
                member: "linkify",
            },
            contract: ext::Feature::Linkify.contract(),
            #[cfg(feature = "syntax")]
            syntax: || &crate::traq_linkify_syntax().plugin,
        },
        FeatureDefinition {
            id: FeatureId::Spoiler,
            export: Export {
                group: "traq",
                member: "spoiler",
            },
            contract: traq::Feature::Spoiler.contract(),
            #[cfg(feature = "syntax")]
            syntax: markdown_trap_syntax::spoiler::plugin,
        },
        FeatureDefinition {
            id: FeatureId::References,
            export: Export {
                group: "traq",
                member: "references",
            },
            contract: traq::Feature::References.contract(),
            #[cfg(feature = "syntax")]
            syntax: markdown_trap_syntax::references::plugin,
        },
        FeatureDefinition {
            id: FeatureId::Stamp,
            export: Export {
                group: "traq",
                member: "stamp",
            },
            contract: traq::Feature::Stamp.contract(),
            #[cfg(feature = "syntax")]
            syntax: markdown_trap_syntax::stamp::plugin,
        },
        FeatureDefinition {
            id: FeatureId::Spacing,
            export: Export {
                group: "traq",
                member: "spacing",
            },
            contract: traq::Feature::Spacing.contract(),
            #[cfg(feature = "syntax")]
            syntax: markdown_trap_syntax::spacing::plugin,
        },
    ]
}
