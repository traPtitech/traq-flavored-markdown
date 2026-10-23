//! Related consumers share one immutable validated document.
use crate::{
    Result,
    extraction::{Extraction, Extractor, ExtractorOptions},
    rendering::{PlainTextRenderer, RendererOptions, WhitespacePolicy},
};
use markdown_ast::DocumentView;
use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Deserialize, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct ProcessorOptions {
    #[serde(default)]
    pub origin: String,
    #[serde(default)]
    pub whitespace: WhitespacePolicy,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProcessingResult {
    pub extraction: Extraction,
    pub plain_text: String,
}

pub struct Processor {
    extractor: Extractor,
    renderer: PlainTextRenderer,
}

impl Processor {
    pub fn new(options: ProcessorOptions) -> Result<Self> {
        Ok(Self {
            extractor: Extractor::new(ExtractorOptions {
                origin: options.origin.clone(),
            })?,
            renderer: PlainTextRenderer::new(RendererOptions {
                origin: options.origin,
                whitespace: options.whitespace,
            })?,
        })
    }

    pub fn process(&self, document: DocumentView<'_>) -> Result<ProcessingResult> {
        Ok(ProcessingResult {
            extraction: self.extractor.extract(document)?,
            plain_text: self.renderer.render(document)?,
        })
    }
}
