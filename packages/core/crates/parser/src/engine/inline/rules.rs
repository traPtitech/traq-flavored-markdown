use super::{InlineInput, InlineMatch, TextInput, TextMatch};
use crate::engine::{Budget, ParseError, Rule};
use std::sync::Arc;

type ParseRule =
    dyn Fn(&InlineInput<'_>, &mut Budget) -> Result<Option<InlineMatch>, ParseError> + Send + Sync;

#[derive(Clone)]
pub struct InlineDefinition {
    pub(crate) markers: &'static [u8],
    pub(crate) parse: Arc<ParseRule>,
}
pub type InlineRule = Rule<InlineDefinition>;

impl InlineRule {
    pub fn new<F>(markers: &'static [u8], parse: F) -> Self
    where
        F: Fn(&InlineInput<'_>, &mut Budget) -> Result<Option<InlineMatch>, ParseError>
            + Send
            + Sync
            + 'static,
    {
        Self::from(InlineDefinition {
            markers,
            parse: Arc::new(parse),
        })
    }
}

type TextParser =
    dyn Fn(&TextInput<'_>, &mut Budget) -> Result<Vec<TextMatch>, ParseError> + Send + Sync;

#[derive(Clone)]
pub struct TextDefinition {
    pub(crate) parse: Arc<TextParser>,
}

pub type TextRule = Rule<TextDefinition>;

impl TextRule {
    pub fn new<F>(parse: F) -> Self
    where
        F: Fn(&TextInput<'_>, &mut Budget) -> Result<Vec<TextMatch>, ParseError>
            + Send
            + Sync
            + 'static,
    {
        Self::from(TextDefinition {
            parse: Arc::new(parse),
        })
    }
}
