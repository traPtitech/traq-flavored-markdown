//! PlainText rendering policy for traQ messages.
use markdown_ast::{Document, ValidatedDocument, ValidationError};
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
    pub fn new(options: RendererOptions) -> Result<Self, &'static str> {
        Ok(Self {
            renderer: Renderer::new(&crate::presets::traq::plain_text::preset(&options.origin)?),
        })
    }

    pub fn render(&self, document: &Document) -> Result<String, &'static str> {
        self.render_validated(ValidatedDocument::new(document).map_err(ValidationError::code)?)
    }

    /// Share one validation with other native consumers during this borrow.
    pub fn render_validated(
        &self,
        document: ValidatedDocument<'_>,
    ) -> Result<String, &'static str> {
        Ok(self
            .renderer
            .render_validated(document)?
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" "))
    }
}
