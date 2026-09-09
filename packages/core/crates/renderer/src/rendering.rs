use crate::{Preset, Result};
use markdown_ast::{Document, Node, ValidationError, ValidationLimits};
use std::cell::Cell;

pub struct Renderer {
    preset: Preset,
}

impl Renderer {
    pub fn new(preset: &Preset) -> Self {
        Self {
            preset: preset.clone(),
        }
    }

    pub fn render(&self, doc: &Document) -> Result<String> {
        validate_document(doc)?;
        self.ensure_supported_nodes(&doc.children)?;

        Context {
            renderer: self,
            work: Cell::new(0),
        }
        .children(&doc.children)
    }

    fn ensure_supported_nodes(&self, nodes: &[Node]) -> Result<()> {
        // Registration is renderer policy. Check even hidden descendants before
        // executing any handler, after the common tree validation succeeds.
        let mut pending: Vec<_> = nodes.iter().collect();

        while let Some(node) = pending.pop() {
            if !self.preset.handlers.contains_key(&node.data_type_id()) {
                return Err("unsupported_node");
            }
            pending.extend(&node.children);
        }

        Ok(())
    }
}

fn validate_document(doc: &Document) -> Result<()> {
    doc.validate(ValidationLimits::default())
        .map_err(|error| match error {
            ValidationError::InvalidSpan | ValidationError::InvalidNode => "invalid_node",
            ValidationError::SourceBytes | ValidationError::Nodes | ValidationError::Depth => {
                "resource_limit"
            }
        })?;
    Ok(())
}

pub struct Context<'a> {
    renderer: &'a Renderer,
    work: Cell<usize>,
}

impl Context<'_> {
    pub fn append(&self, output: &mut String, value: &str) -> Result<()> {
        let work = self.work.get().saturating_add(value.len());

        if output.len().saturating_add(value.len()) > 1_048_576 || work > 8_388_608 {
            return Err("resource_limit");
        }

        self.work.set(work);
        output.push_str(value);

        Ok(())
    }

    pub fn children(&self, nodes: &[Node]) -> Result<String> {
        let mut output = String::new();

        for node in nodes {
            let handler = self
                .renderer
                .preset
                .handlers
                .get(&node.data_type_id())
                .ok_or("unsupported_node")?;
            let rendered = handler(node, self)?;
            self.append(&mut output, &rendered)?;
        }

        Ok(output)
    }
}
