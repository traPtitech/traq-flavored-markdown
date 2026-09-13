//! Source-preserving message text and attachment/citation extraction from one AST.
use crate::links::{Links, Target};
use markdown_ast::{Document, Span, ValidatedDocument};
use markdown_commonmark_contracts::{Link, LinkForm};
use markdown_trap_contracts::{EmbeddingData, EmbeddingKind, ReferenceData};
use markdown_trap_extraction::normalize_reference_id;

#[derive(Debug, Default, PartialEq)]
pub struct Message {
    pub plain_text: String,
    pub attachments: Vec<String>,
    pub citations: Vec<String>,
}

pub struct Extractor {
    links: Links,
}

impl Extractor {
    pub fn new(origin: &str) -> Self {
        Self {
            links: Links::new(origin),
        }
    }

    pub fn extract(&self, document: &Document) -> Result<Message, &'static str> {
        self.extract_validated(ValidatedDocument::new(document).map_err(|_| "invalid_node")?)
    }

    pub(crate) fn extract_validated(
        &self,
        document: ValidatedDocument<'_>,
    ) -> Result<Message, &'static str> {
        let document = document.document();
        let mut message = Message::default();
        let edits = self.collect_edits(document, &mut message);
        message.plain_text = crate::edits::apply(&document.source, edits)?;
        Ok(message)
    }

    fn collect_edits<'a>(
        &self,
        document: &'a Document,
        message: &mut Message,
    ) -> Vec<(Span, &'a str)> {
        let mut edits = Vec::new();
        let mut pending: Vec<_> = document.children.iter().rev().collect();
        while let Some(node) = pending.pop() {
            if let Some(reference) = node.get::<ReferenceData>() {
                if normalize_reference_id(&reference.id).is_some() {
                    edits.push((node.span, reference.label.as_str()));
                }
            } else if let Some(embedding) = node.get::<EmbeddingData>() {
                if let Some(id) = normalize_reference_id(&embedding.id) {
                    let label = match embedding.target {
                        EmbeddingKind::File => {
                            message.attachments.push(id);
                            "[添付ファイル]"
                        }
                        EmbeddingKind::Message => {
                            message.citations.push(id);
                            "[引用メッセージ]"
                        }
                    };
                    edits.push((node.span, label));
                }
            } else if let Some(link) = node.get::<Link>()
                && let Some(target) = self.links.classify(&link.destination)
            {
                let label = match target {
                    Target::File { id } => {
                        message.attachments.push(id);
                        "[添付ファイル]"
                    }
                    Target::Message { id } => {
                        message.citations.push(id);
                        "[引用メッセージ]"
                    }
                };
                // Explicit labels and reference definitions retain their Markdown source.
                // Bare and angle-bracket links are the source notation for embedded URLs.
                if link.form != LinkForm::Explicit {
                    let raw = &document.source[node.span.start..node.span.end];
                    let span = if raw.starts_with('<') && raw.ends_with('>') {
                        Span {
                            start: node.span.start + 1,
                            end: node.span.end - 1,
                        }
                    } else {
                        node.span
                    };
                    edits.push((span, label));
                }
            }
            pending.extend(node.children.iter().rev());
        }
        edits
    }
}
