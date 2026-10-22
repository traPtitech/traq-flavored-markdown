//! PlainText rendering policy for traQ messages.
use markdown_ast::{Document, ValidatedDocument};
use markdown_renderer::Renderer;
use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Deserialize, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct RendererOptions {
    #[serde(default)]
    pub origin: String,
}

pub struct PlainTextRenderer {
    renderer: Renderer,
}

impl PlainTextRenderer {
    pub fn new(options: RendererOptions) -> crate::Result<Self> {
        Ok(Self {
            renderer: Renderer::new(&crate::presets::traq::plain_text::preset(&options.origin)?),
        })
    }

    pub fn render(&self, document: &Document) -> crate::Result<String> {
        self.render_validated(ValidatedDocument::new(document)?)
    }

    /// Share one validation with other native consumers during this borrow.
    pub fn render_validated(&self, document: ValidatedDocument<'_>) -> crate::Result<String> {
        Ok(self
            .renderer
            .render_validated(document)?
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" "))
    }
}
