//! Distribution-owned processing presets. All consumers borrow one native AST.
#![forbid(unsafe_code)]

use crate::{References, presets::traq};
use markdown_ast::{Document, Span, ValidatedDocument, ValidationError};
use markdown_trap_contracts::{EmbeddingData, ReferenceData};
use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Deserialize, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct ExtractorOptions {
    /// Origin used to recognize traQ file/message URLs; empty leaves URLs as text.
    #[serde(default)]
    pub origin: String,
}

#[derive(Debug, PartialEq, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
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
    message: traq::message::Extractor,
}

impl Extractor {
    pub fn new(options: ExtractorOptions) -> Result<Self, &'static str> {
        crate::links::validate_origin(&options.origin)?;

        Ok(Self {
            message: traq::message::Extractor::new(&options.origin),
        })
    }

    pub fn extract(&self, document: &Document) -> Result<Extraction, String> {
        let document = ValidatedDocument::new(document).map_err(ValidationError::code)?;
        self.extract_validated(document)
    }

    /// Share one validation with other native consumers during this borrow.
    pub fn extract_validated(&self, document: ValidatedDocument<'_>) -> Result<Extraction, String> {
        Analysis::run(document.document(), &self.message)
    }
}

#[derive(Default)]
struct Analysis<'a> {
    references: References,
    message: traq::message::Message,
    embedding: traq::embedding::EmbeddingPlan,
    message_edits: Vec<(Span, &'a str)>,
    embedding_edits: Vec<(Span, &'a str)>,
}

impl<'a> Analysis<'a> {
    fn run(
        document: &'a Document,
        message_policy: &traq::message::Extractor,
    ) -> Result<Extraction, String> {
        let mut analysis = Self::default();
        let mut pending: Vec<_> = document
            .children
            .iter()
            .rev()
            .map(|node| (node, true))
            .collect();

        while let Some((node, allow_embedding)) = pending.pop() {
            if let Some(reference) = node.get::<ReferenceData>() {
                analysis.references.record_reference(reference);
            } else if let Some(embedding) = node.get::<EmbeddingData>() {
                analysis.references.record_embedding(embedding);
            }

            message_policy.observe(
                node,
                &document.source,
                &mut analysis.message,
                &mut analysis.message_edits,
            );
            let allow_children = traq::embedding::observe(
                node,
                &document.source,
                allow_embedding,
                &mut analysis.embedding,
                &mut analysis.embedding_edits,
            );
            pending.extend(
                node.children
                    .iter()
                    .rev()
                    .map(|child| (child, allow_children)),
            );
        }

        let Analysis {
            references,
            mut message,
            embedding,
            message_edits,
            embedding_edits,
        } = analysis;
        message.plain_text =
            crate::edits::apply(&document.source, message_edits).map_err(str::to_owned)?;
        let embedding = traq::embedding::finish(&document.source, embedding, embedding_edits)
            .map_err(str::to_owned)?;

        Ok(Extraction {
            message_text: message.plain_text,
            attachments: message.attachments,
            citations: message.citations,
            references,
            embedding,
        })
    }
}
