//! PlainText rendering policy for traQ messages.
use markdown_ast::{Document, ValidatedDocument};
use markdown_renderer::Renderer;
use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Clone, Copy, Deserialize, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum WhitespacePolicy {
    Preserve,
    #[default]
    Collapse,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct RendererOptions {
    #[serde(default)]
    pub origin: String,
    #[serde(default)]
    pub whitespace: WhitespacePolicy,
}

pub struct PlainTextRenderer {
    renderer: Renderer,
    whitespace: WhitespacePolicy,
}

impl PlainTextRenderer {
    pub fn new(options: RendererOptions) -> crate::Result<Self> {
        Ok(Self {
            renderer: Renderer::new(&crate::presets::traq::plain_text::preset(&options.origin)?),
            whitespace: options.whitespace,
        })
    }

    pub fn render(&self, document: &Document) -> crate::Result<String> {
        self.render_validated(ValidatedDocument::new(document)?)
    }

    /// Share one validation with other native consumers during this borrow.
    pub fn render_validated(&self, document: ValidatedDocument<'_>) -> crate::Result<String> {
        let text = self.renderer.render_validated(document)?;
        Ok(match self.whitespace {
            WhitespacePolicy::Preserve => text,
            WhitespacePolicy::Collapse => text.split_whitespace().collect::<Vec<_>>().join(" "),
        })
    }
}
