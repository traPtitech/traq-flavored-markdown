//! Profile policy owns feature order and rule precedence together.
use crate::FeatureId;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GrammarProfile {
    Commonmark,
    TraqV1,
}

pub struct GrammarProfileDefinition {
    pub features: &'static [FeatureId],
    #[cfg(feature = "syntax")]
    precedence: fn() -> Vec<Precedence>,
}

impl GrammarProfile {
    pub fn definition(self) -> &'static GrammarProfileDefinition {
        use FeatureId::*;
        static COMMONMARK: GrammarProfileDefinition = GrammarProfileDefinition {
            features: &[Core, Html],
            #[cfg(feature = "syntax")]
            precedence: commonmark_precedence,
        };
        static TRAQ_V1: GrammarProfileDefinition = GrammarProfileDefinition {
            features: &[
                Core,
                Table,
                Math,
                Strikethrough,
                Mark,
                Spoiler,
                References,
                Stamp,
                Linkify,
                Spacing,
            ],
            #[cfg(feature = "syntax")]
            precedence: traq_precedence,
        };
        match self {
            Self::Commonmark => &COMMONMARK,
            Self::TraqV1 => &TRAQ_V1,
        }
    }

    #[cfg(feature = "syntax")]
    pub fn grammar_builder(
        self,
    ) -> Result<markdown_parser::GrammarBuilder, markdown_parser::BuildError> {
        let definition = self.definition();
        let precedence = definition.precedence;
        let mut builder = markdown_parser::GrammarBuilder::new();
        for feature in crate::grammar_features(self) {
            builder.add((feature.syntax)())?;
        }
        for ordering in precedence() {
            match ordering {
                Precedence::Inline(rule, anchor) => {
                    builder.before(rule, anchor)?;
                }
                Precedence::Block(rule, anchor) => {
                    builder.before(rule, anchor)?;
                }
            }
        }
        Ok(builder)
    }
}

#[cfg(feature = "syntax")]
enum Precedence {
    Inline(
        &'static markdown_parser::rules::inline::InlineRule,
        &'static markdown_parser::rules::inline::InlineRule,
    ),
    Block(
        &'static markdown_parser::rules::block::BlockRule,
        &'static markdown_parser::rules::block::BlockRule,
    ),
}

#[cfg(feature = "syntax")]
fn commonmark_precedence() -> Vec<Precedence> {
    let base = crate::commonmark_syntax();
    vec![
        Precedence::Inline(
            markdown_commonmark::html::inline_rule(),
            &base.inline.entity,
        ),
        Precedence::Block(markdown_commonmark::html::block_rule(), &base.block.heading),
    ]
}

#[cfg(feature = "syntax")]
fn traq_precedence() -> Vec<Precedence> {
    use Precedence::{Block, Inline};
    use markdown_extensions_syntax as extensions;
    use markdown_traq_syntax as traq;
    let base = crate::commonmark_syntax();
    vec![
        Inline(extensions::math::inline_rule(), &base.inline.code),
        Inline(traq::spoiler::inline_rule(), &base.inline.emphasis),
        Inline(
            extensions::strikethrough::inline_rule(),
            &base.inline.emphasis,
        ),
        Inline(extensions::mark::inline_rule(), &base.inline.emphasis),
        Inline(traq::references::inline_rule(), &base.inline.link),
        Inline(traq::stamp::inline_rule(), &base.inline.entity),
        Inline(&crate::traq_linkify_syntax().inline, &base.inline.entity),
        Block(traq::spacing::blank_rule(), &base.block.blank),
        Block(extensions::table::block_rule(), &base.block.fence),
        Block(extensions::math::block_rule(), &base.block.fence),
    ]
}

/// Rendering profiles cannot be passed to grammar construction.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextProfile {
    Traq,
}

#[cfg(feature = "text")]
impl TextProfile {
    pub fn features(self) -> &'static [crate::TextFeature] {
        use crate::TextFeature::*;
        match self {
            Self::Traq => &[
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
            ],
        }
    }
}
