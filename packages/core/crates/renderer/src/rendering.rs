use crate::{Error, Preset, Result};
use markdown_ast::{Document, Node, ValidatedDocument};
use std::cell::Cell;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RenderLimits {
    pub output_bytes: usize,
    /// Includes writes into temporary captures as well as final output.
    pub work_bytes: usize,
}
impl Default for RenderLimits {
    fn default() -> Self {
        Self {
            output_bytes: 1_048_576,
            work_bytes: 8_388_608,
        }
    }
}

pub struct Renderer {
    preset: Preset,
    limits: RenderLimits,
}
impl Renderer {
    pub fn new(preset: &Preset) -> Self {
        Self {
            preset: preset.clone(),
            limits: RenderLimits::default(),
        }
    }
    pub fn with_limits(mut self, limits: RenderLimits) -> Self {
        self.limits = limits;
        self
    }
    pub fn render(&self, document: &Document) -> Result<String> {
        self.render_validated(ValidatedDocument::new(document)?)
    }
    /// Validation and handler support cover even descendants hidden by a handler.
    pub fn render_validated(&self, document: ValidatedDocument<'_>) -> Result<String> {
        for visit in document.walk() {
            if !self
                .preset
                .handlers
                .contains_key(&visit.node.data_type_id())
            {
                return Err(Error::UnsupportedNode {
                    payload_type: visit.node.data_type_name(),
                });
            }
        }
        let context = Context {
            renderer: self,
            work: Cell::new(0),
        };
        let mut output = context.output();
        context.children(&document.document().children, &mut output)?;
        Ok(output.text)
    }
}

pub struct Context<'a> {
    renderer: &'a Renderer,
    work: Cell<usize>,
}
impl Context<'_> {
    fn output(&self) -> Output<'_> {
        Output {
            text: String::new(),
            limits: self.renderer.limits,
            work: &self.work,
        }
    }
    pub fn node(&self, node: &Node, output: &mut Output<'_>) -> Result<()> {
        let handler = self
            .renderer
            .preset
            .handlers
            .get(&node.data_type_id())
            .ok_or(Error::UnsupportedNode {
                payload_type: node.data_type_name(),
            })?;
        handler(node, self, output)
    }
    pub fn children(&self, nodes: &[Node], output: &mut Output<'_>) -> Result<()> {
        for node in nodes {
            self.node(node, output)?;
        }
        Ok(())
    }
    /// Use only when a handler transforms rendered children (for example spoiler
    /// masking or list trimming). The capture shares the total work budget.
    pub fn capture_children(&self, nodes: &[Node]) -> Result<String> {
        let mut output = self.output();
        self.children(nodes, &mut output)?;
        Ok(output.text)
    }
}

/// A bounded sink. Handlers cannot allocate an unbounded subtree result or bypass
/// accounting by gaining mutable access to its buffer.
pub struct Output<'a> {
    text: String,
    limits: RenderLimits,
    work: &'a Cell<usize>,
}
impl Output<'_> {
    pub fn push(&mut self, value: &str) -> Result<()> {
        if value.len() > self.limits.output_bytes.saturating_sub(self.text.len()) {
            return Err(Error::ResourceLimit {
                resource: "output_bytes",
                limit: self.limits.output_bytes,
            });
        }
        let work = self
            .work
            .get()
            .checked_add(value.len())
            .filter(|work| *work <= self.limits.work_bytes)
            .ok_or(Error::ResourceLimit {
                resource: "work_bytes",
                limit: self.limits.work_bytes,
            })?;
        self.work.set(work);
        self.text.push_str(value);
        Ok(())
    }
}
