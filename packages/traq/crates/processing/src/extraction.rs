//! Distribution-owned processing presets. All consumers borrow one native AST.
#![forbid(unsafe_code)]

use crate::{References, presets::traq};
use markdown_ast::Document;
use markdown_extractor::Extractor as ReferenceExtractor;
use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Deserialize, Serialize)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct ExtractorOptions {
    /// Origin used to recognize traQ file/message URLs; empty leaves URLs as text.
    #[serde(default)]
    pub origin: String,
}

#[derive(Debug, PartialEq, Serialize)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Extraction {
    pub message_text: String,
    pub attachments: Vec<String>,
    pub citations: Vec<String>,
    pub references: References,
    pub embedding: traq::embedding::EmbeddingPlan,
}

/// Owns the Rust implementations, without external document handles or AST copies.
pub struct Extractor {
    extractor: ReferenceExtractor<References>,
    message: traq::message::Extractor,
}

impl Extractor {
    pub fn new(options: ExtractorOptions) -> Result<Self, &'static str> {
        if options.origin.len() > 2048 {
            return Err("origin_limit");
        }
        Ok(Self {
            extractor: ReferenceExtractor::new(&traq::references::preset()?),
            message: traq::message::Extractor::new(&options.origin),
        })
    }

    pub fn extract(&self, document: &Document) -> Result<Extraction, String> {
        let references = self.extractor.extract(document)?;
        let message = self.message.extract(document)?;
        Ok(Extraction {
            message_text: message.plain_text,
            attachments: message.attachments,
            citations: message.citations,
            references,
            embedding: traq::embedding::plan(document).map_err(str::to_owned)?,
        })
    }
}
