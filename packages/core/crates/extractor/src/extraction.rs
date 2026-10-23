use crate::{Preset, Result};
use markdown_ast::Node;

pub struct Extractor<R> {
    preset: Preset<R>,
}

impl<R> Extractor<R> {
    pub fn new(preset: &Preset<R>) -> Self {
        Self {
            preset: preset.clone(),
        }
    }

    /// Start a fresh result and visit every node in document preorder. Unknown
    /// types are not collected, but their validation and descendants still count.
    /// Reuse validation when several consumers share one immutable document.
    pub fn extract<'a>(&self, document: impl markdown_ast::DocumentInput<'a>) -> Result<R>
    where
        R: Default,
    {
        let document = document.into_view()?;
        let mut result = R::default();
        for visit in document.walk() {
            self.observe(visit.node, &mut result)?;
        }
        Ok(result)
    }

    /// Collect one node while another consumer owns validated document traversal.
    /// Payload handlers inspect this node only and never recurse themselves.
    pub fn observe(&self, node: &Node, result: &mut R) -> Result<()> {
        if let Some(handler) = self.preset.handlers.get(&node.data_type_id()) {
            handler(node, result)?;
        }
        Ok(())
    }
}
