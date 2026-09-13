use crate::{Preset, Result};
use markdown_ast::{Document, Node, ValidatedDocument, ValidationError};

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
    pub fn extract(&self, document: &Document) -> Result<R>
    where
        R: Default,
    {
        self.extract_validated(ValidatedDocument::new(document).map_err(ValidationError::code)?)
    }

    /// Reuse validation when several consumers share one immutable document.
    pub fn extract_validated(&self, document: ValidatedDocument<'_>) -> Result<R>
    where
        R: Default,
    {
        let mut result = R::default();
        self.visit_nodes(&document.document().children, &mut result)?;
        Ok(result)
    }

    fn visit_nodes(&self, nodes: &[Node], result: &mut R) -> Result<()> {
        let mut pending: Vec<_> = nodes.iter().rev().collect();
        while let Some(node) = pending.pop() {
            if let Some(handler) = self.preset.handlers.get(&node.data_type_id()) {
                handler(node, result)?;
            }
            pending.extend(node.children.iter().rev());
        }

        Ok(())
    }
}
