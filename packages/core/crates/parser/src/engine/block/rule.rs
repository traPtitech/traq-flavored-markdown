use super::{BlockInput, BlockMatch, BlockProbe};
use crate::engine::{Budget, ParseError, Rule};
use std::sync::Arc;

type ParseRule =
    dyn Fn(&BlockInput<'_>, &mut Budget) -> Result<Option<BlockMatch>, ParseError> + Send + Sync;

type ProbeRule = dyn Fn(&BlockProbe<'_>) -> bool + Send + Sync;

#[derive(Clone)]
pub struct BlockDefinition {
    pub(crate) parse: Arc<ParseRule>,
    pub(crate) interrupt: Option<Arc<ProbeRule>>,
}

pub type BlockRule = Rule<BlockDefinition>;

impl BlockRule {
    pub fn new<F>(parse: F) -> Self
    where
        F: Fn(&BlockInput<'_>, &mut Budget) -> Result<Option<BlockMatch>, ParseError>
            + Send
            + Sync
            + 'static,
    {
        Self::from(BlockDefinition {
            parse: Arc::new(parse),
            interrupt: None,
        })
    }

    pub fn interrupts<F>(mut self, probe: F) -> Self
    where
        F: Fn(&BlockProbe<'_>) -> bool + Send + Sync + 'static,
    {
        Arc::make_mut(&mut self.data).implementation.interrupt = Some(Arc::new(probe));
        self
    }
}
