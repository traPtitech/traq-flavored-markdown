use super::{Export, FeatureDefinition};
#[cfg(feature = "syntax")]
use crate::commonmark_syntax;
use std::sync::LazyLock;

// Generate the closed identifier set and its complete, ordered table together.
// An identifier cannot be added without supplying its definition.
macro_rules! feature_definitions {
    ($(
        $id:ident => ($group:literal, $member:literal, $contract:expr, $syntax:expr)
    ),+ $(,)?) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
        pub enum FeatureId {
            $($id),+
        }

        pub fn all() -> &'static [FeatureDefinition] {
            const COUNT: usize = [$(stringify!($id)),+].len();
            static FEATURES: LazyLock<[FeatureDefinition; COUNT]> = LazyLock::new(|| [
                $(FeatureDefinition {
                    id: FeatureId::$id,
                    export: Export { group: $group, member: $member },
                    contract: $contract,
                    #[cfg(feature = "syntax")]
                    syntax: $syntax,
                }),+
            ]);
            FEATURES.as_slice()
        }

        impl FeatureId {
            pub fn definition(self) -> &'static FeatureDefinition {
                // Both sequences come from the same declaration, in enum order.
                &all()[self as usize]
            }
        }
    };
}

feature_definitions! {
    Core => (
        "commonmark", "core",
        markdown_commonmark_contracts::Feature::Core.contract(),
        || &commonmark_syntax().plugin
    ),
    Html => (
        "commonmark", "html",
        markdown_commonmark_contracts::Feature::Html.contract(),
        markdown_commonmark::html::plugin
    ),
    Math => (
        "extensions", "math",
        markdown_extensions_contracts::Feature::Math.contract(),
        markdown_extensions_syntax::math::plugin
    ),
    Mark => (
        "extensions", "mark",
        markdown_extensions_contracts::Feature::Mark.contract(),
        markdown_extensions_syntax::mark::plugin
    ),
    Strikethrough => (
        "extensions", "strikethrough",
        markdown_extensions_contracts::Feature::Strikethrough.contract(),
        markdown_extensions_syntax::strikethrough::plugin
    ),
    Table => (
        "extensions", "table",
        markdown_extensions_contracts::Feature::Table.contract(),
        markdown_extensions_syntax::table::plugin
    ),
    Linkify => (
        "extensions", "linkify",
        markdown_extensions_contracts::Feature::Linkify.contract(),
        || &crate::traq_linkify_syntax().plugin
    ),
    Spoiler => (
        "traq", "spoiler",
        markdown_traq_contracts::Feature::Spoiler.contract(),
        markdown_traq_syntax::spoiler::plugin
    ),
    References => (
        "traq", "references",
        markdown_traq_contracts::Feature::References.contract(),
        markdown_traq_syntax::references::plugin
    ),
    Stamp => (
        "traq", "stamp",
        markdown_traq_contracts::Feature::Stamp.contract(),
        markdown_traq_syntax::stamp::plugin
    ),
    Spacing => (
        "traq", "spacing",
        markdown_traq_contracts::Feature::Spacing.contract(),
        markdown_traq_syntax::spacing::plugin
    ),
}
