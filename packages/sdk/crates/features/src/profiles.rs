//! Profile policy owns feature order and rule precedence together.
use crate::FeatureId;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Profile {
    Commonmark,
    TraqV1,
    TraqPlainText,
}

pub struct ProfileDefinition {
    pub features: &'static [FeatureId],
    #[cfg(feature = "syntax")]
    precedence: Option<fn() -> Vec<Precedence>>,
}

impl Profile {
    pub fn definition(self) -> &'static ProfileDefinition {
        use FeatureId::*;
        static COMMONMARK: ProfileDefinition = ProfileDefinition {
            features: &[Core, Html],
            #[cfg(feature = "syntax")]
            precedence: Some(commonmark_precedence),
        };
        static TRAQ_V1: ProfileDefinition = ProfileDefinition {
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
            precedence: Some(traq_precedence),
        };
        static PLAIN_TEXT: ProfileDefinition = ProfileDefinition {
            features: &[
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
            #[cfg(feature = "syntax")]
            precedence: None,
        };
        match self {
            Self::Commonmark => &COMMONMARK,
            Self::TraqV1 => &TRAQ_V1,
            Self::TraqPlainText => &PLAIN_TEXT,
        }
    }

    #[cfg(feature = "syntax")]
    pub fn grammar_builder(
        self,
    ) -> Result<markdown_parser::GrammarBuilder, markdown_parser::BuildError> {
        let definition = self.definition();
        let precedence = definition.precedence.ok_or_else(|| {
            markdown_parser::BuildError::InvalidDefinition {
                reason: "profile has no syntax capability".into(),
            }
        })?;
        let mut builder = markdown_parser::GrammarBuilder::new();
        for feature in crate::selected(self) {
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
        &'static markdown_parser::engine::inline::InlineRule,
        &'static markdown_parser::engine::inline::InlineRule,
    ),
    Block(
        &'static markdown_parser::engine::block::BlockRule,
        &'static markdown_parser::engine::block::BlockRule,
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
    use markdown_trap_syntax as traq;
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
