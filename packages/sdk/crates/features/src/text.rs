use crate::{FeatureDefinition, FeatureId, TextOptions};

/// Only features that implement plain-text rendering can inhabit this type.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextFeature {
    Core,
    Html,
    Math,
    Mark,
    Strikethrough,
    Table,
    References,
    Stamp,
    Spoiler,
    Spacing,
}

impl TextFeature {
    pub fn definition(self) -> &'static FeatureDefinition {
        match self {
            Self::Core => FeatureId::Core,
            Self::Html => FeatureId::Html,
            Self::Math => FeatureId::Math,
            Self::Mark => FeatureId::Mark,
            Self::Strikethrough => FeatureId::Strikethrough,
            Self::Table => FeatureId::Table,
            Self::References => FeatureId::References,
            Self::Stamp => FeatureId::Stamp,
            Self::Spoiler => FeatureId::Spoiler,
            Self::Spacing => FeatureId::Spacing,
        }
        .definition()
    }
    pub fn plugin(self, options: TextOptions) -> markdown_renderer::RenderPlugin {
        match self {
            Self::Core => {
                markdown_commonmark_text::plugin_with_options(markdown_commonmark_text::Options {
                    explicit_links: options.explicit_links,
                })
            }
            Self::Html => markdown_commonmark_text::html::plugin(),
            Self::Math => markdown_extensions_text::math::plugin_with_options(
                markdown_extensions_text::math::Options {
                    style: options.math,
                },
            ),
            Self::Mark => markdown_extensions_text::mark::plugin(),
            Self::Strikethrough => markdown_extensions_text::strikethrough::plugin(),
            Self::Table => markdown_extensions_text::table::plugin(),
            Self::References => markdown_trap_text::references::plugin(),
            Self::Stamp => markdown_trap_text::stamp::plugin(),
            Self::Spoiler => markdown_trap_text::spoiler::plugin(),
            Self::Spacing => markdown_trap_text::spacing::plugin(),
        }
    }
}
