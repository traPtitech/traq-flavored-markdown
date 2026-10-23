//! Message meaning is collected independently of rendering and response formatting.
use crate::{References, Result, presets::traq};
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
    pub reference_embedding: traq::embedding::ReferenceEmbeddingPlan,
}

/// Semantic analysis can be reused by presentation, source editing, and wire
/// extraction without traversing the document for each view.
#[derive(Debug, PartialEq)]
pub struct MessageAnalysis {
    pub references: References,
    pub message: traq::message::Message,
    pub reference_embedding: traq::embedding::ReferenceEmbeddingPlan,
}
impl From<MessageAnalysis> for Extraction {
    fn from(analysis: MessageAnalysis) -> Self {
        Self {
            message_text: analysis.message.source_text,
            attachments: analysis.message.attachments,
            citations: analysis.message.citations,
            references: analysis.references,
            reference_embedding: analysis.reference_embedding,
        }
    }
}

pub struct Extractor {
    message: traq::message::Extractor,
    references: markdown_extractor::Extractor<References>,
}
impl Extractor {
    pub fn new(options: ExtractorOptions) -> Result<Self> {
        crate::links::validate_origin(&options.origin)?;
        Ok(Self {
            message: traq::message::Extractor::new(&options.origin),
            references: markdown_extractor::Extractor::new(&traq::references::preset()?),
        })
    }
    pub fn extract<'a>(
        &self,
        document: impl markdown_ast::DocumentInput<'a>,
    ) -> Result<Extraction> {
        let document = document.into_view()?;
        self.analyze(document).map(Into::into)
    }
    pub fn analyze<'a>(
        &self,
        document: impl markdown_ast::DocumentInput<'a>,
    ) -> Result<MessageAnalysis> {
        let document = document.into_view()?;
        let mut collectors = (
            self.references.collector::<crate::Error>(),
            (
                traq::message::Collector::new(&self.message),
                traq::embedding::Collector::default(),
            ),
        );
        markdown_extractor::collect(document, &mut collectors)?;
        let (references, (message, embedding)) = collectors;
        let source = &document.document().source;
        Ok(MessageAnalysis {
            references: references.finish(),
            message: message.finish(source)?,
            reference_embedding: embedding.finish(source)?,
        })
    }
}
