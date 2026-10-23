//! SDK feature assembly. Contracts remain independent of syntax and rendering.
#![doc = include_str!("../README.md")]
#![forbid(unsafe_code)]

use markdown_definitions::FeatureContract;
use std::sync::LazyLock;

#[cfg(feature = "syntax")]
mod linkify;
mod profiles;
mod table;
#[cfg(feature = "syntax")]
pub use linkify::syntax as traq_linkify_syntax;
pub use profiles::{GrammarProfile, GrammarProfileDefinition, TextProfile};
#[cfg(feature = "text")]
mod text;
#[cfg(feature = "text")]
pub use text::TextFeature;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum FeatureId {
    Core,
    Html,
    Math,
    Mark,
    Strikethrough,
    Table,
    Linkify,
    Spoiler,
    References,
    Stamp,
    Spacing,
}

#[derive(Debug)]
pub struct Export {
    pub group: &'static str,
    pub member: &'static str,
}

/// One feature's contract, SDK export, and available implementations.
pub struct FeatureDefinition {
    pub id: FeatureId,
    pub export: Export,
    pub contract: &'static FeatureContract,
    #[cfg(feature = "syntax")]
    pub syntax: fn() -> &'static markdown_parser::grammar::SyntaxPlugin,
}

pub fn all() -> &'static [FeatureDefinition] {
    static FEATURES: LazyLock<Vec<FeatureDefinition>> = LazyLock::new(table::definitions);
    &FEATURES
}

impl FeatureId {
    pub fn definition(self) -> &'static FeatureDefinition {
        all()
            .iter()
            .find(|feature| feature.id == self)
            .expect("registered SDK feature")
    }
}

/// Ordered feature capabilities selected by the profile policy.
pub fn grammar_features(
    profile: GrammarProfile,
) -> impl Iterator<Item = &'static FeatureDefinition> {
    profile
        .definition()
        .features
        .iter()
        .map(|id| id.definition())
}

#[cfg(feature = "syntax")]
pub fn commonmark_syntax() -> &'static markdown_commonmark::Syntax {
    static SYNTAX: LazyLock<markdown_commonmark::Syntax> =
        LazyLock::new(markdown_commonmark::Syntax::default);
    &SYNTAX
}

#[cfg(feature = "text")]
#[derive(Debug, Clone, Copy)]
pub struct TextOptions {
    pub explicit_links: markdown_commonmark_text::ExplicitLinkStyle,
    pub math: markdown_extensions_text::math::Style,
}
#[cfg(feature = "text")]
impl Default for TextOptions {
    fn default() -> Self {
        Self {
            explicit_links: markdown_commonmark_text::ExplicitLinkStyle::LabelAndDestination,
            math: markdown_extensions_text::math::Style::DelimitedTex,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        any::TypeId,
        collections::{HashMap, HashSet},
    };

    #[test]
    fn every_registered_payload_belongs_to_exactly_one_feature() {
        let mut expected = HashMap::new();
        macro_rules! register {
            ($group:literal; $($ty:ty => $kind:literal),+ $(,)?) => {
                $(assert!(expected.insert(TypeId::of::<$ty>(), $kind).is_none());)+
            };
        }
        markdown_commonmark_contracts::node_catalog!(register);
        markdown_extensions_contracts::node_catalog!(register);
        markdown_trap_contracts::node_catalog!(register);
        let mut actual = HashMap::new();
        let mut exports = HashSet::new();
        let mut ids = HashSet::new();
        for feature in all() {
            assert!(ids.insert(feature.id));
            assert!(exports.insert((feature.export.group, feature.export.member)));
            for payload in &feature.contract.payloads {
                assert!(
                    actual
                        .insert(payload.native, payload.kind.as_str())
                        .is_none(),
                    "duplicate payload {}",
                    payload.kind
                );
            }
        }
        assert_eq!(actual, expected);
    }

    #[test]
    fn profile_orders_are_complete_and_unambiguous() {
        for profile in [GrammarProfile::Commonmark, GrammarProfile::TraqV1] {
            let ids: Vec<_> = grammar_features(profile)
                .map(|feature| feature.id)
                .collect();
            assert_eq!(ids.len(), ids.iter().collect::<HashSet<_>>().len());
            assert_eq!(ids, profile.definition().features);
        }
        assert_eq!(
            grammar_features(GrammarProfile::Commonmark)
                .map(|f| f.id)
                .collect::<Vec<_>>(),
            [FeatureId::Core, FeatureId::Html]
        );
        assert!(!grammar_features(GrammarProfile::TraqV1).any(|f| f.id == FeatureId::Html));
    }

    #[cfg(feature = "syntax")]
    #[test]
    fn syntax_implementations_share_declared_namespaces_and_commonmark_identity() {
        for feature in all() {
            let plugin = (feature.syntax)();
            assert_eq!(plugin.name(), feature.contract.declaration.name());
            assert_eq!(plugin.namespace(), feature.contract.declaration.namespace());
        }
        assert!(std::ptr::eq(
            (FeatureId::Core.definition().syntax)(),
            &commonmark_syntax().plugin
        ));
    }

    #[cfg(feature = "text")]
    #[test]
    fn selected_text_features_have_nonconflicting_implementations() {
        let mut builder = markdown_renderer::RenderPresetBuilder::new();
        for feature in TextProfile::Traq.features() {
            builder
                .add(&feature.plugin(TextOptions::default()))
                .unwrap();
        }
        builder.build().unwrap();
    }
}
