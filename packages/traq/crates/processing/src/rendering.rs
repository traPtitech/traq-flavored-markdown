//! PlainText rendering policy for traQ messages.
use markdown_ast::Document;
use markdown_renderer::Renderer;
use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Deserialize, Serialize)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
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
            renderer: Renderer::new(&crate::presets::traq::notification::preset(
                &options.origin,
            )?),
        })
    }

    pub fn render(&self, document: &Document) -> Result<String, &'static str> {
        Ok(self
            .renderer
            .render(document)?
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" "))
    }
}
