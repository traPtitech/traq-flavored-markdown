use crate::{Preset, Result};
use markdown_ast::{Document, Node, ValidationError, ValidationLimits};

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
        validate_document(document)?;

        let mut result = R::default();
        self.visit_nodes(&document.children, &mut result)?;
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

fn validate_document(document: &Document) -> Result<()> {
    document
        .validate(ValidationLimits::default())
        .map_err(|error| match error {
            ValidationError::InvalidSpan | ValidationError::InvalidNode => "invalid_node",
            ValidationError::SourceBytes | ValidationError::Nodes | ValidationError::Depth => {
                "resource_limit"
            }
        })?;

    Ok(())
}
