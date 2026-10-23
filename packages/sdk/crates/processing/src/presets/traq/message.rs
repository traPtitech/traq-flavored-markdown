//! Source-preserving message text and attachment/citation extraction from one AST.
use super::labels;
use crate::links::{Target, TraqUrlClassifier};
use markdown_ast::{Node, Span};
use markdown_commonmark_contracts::{Link, LinkForm};
use markdown_trap_contracts::{Embedding, EmbeddingKind, Reference};

#[derive(Debug, Default, PartialEq)]
pub struct Message {
    pub source_text: String,
    pub attachments: Vec<String>,
    pub citations: Vec<String>,
}

pub struct Extractor {
    links: TraqUrlClassifier,
}

impl Extractor {
    pub fn new(origin: &str) -> Self {
        Self {
            links: TraqUrlClassifier::new(origin),
        }
    }

    /// Reuse an immutable validation, including explicitly configured tree limits.
    pub fn extract<'a>(
        &self,
        document: impl markdown_ast::DocumentInput<'a>,
    ) -> crate::Result<Message> {
        let document = document.into_view()?;
        let mut collector = Collector::new(self);
        markdown_extractor::collect(document, &mut collector)?;
        collector.finish(&document.document().source)
    }

    pub(crate) fn observe<'a>(
        &self,
        node: &'a Node,
        source: &str,
        message: &mut Message,
        edits: &mut Vec<(Span, &'a str)>,
    ) {
        if let Some(reference) = node.payload::<Reference>() {
            if reference.id.canonical().is_some() {
                edits.push((node.span, reference.label.as_str()));
            }
        } else if let Some(embedding) = node.payload::<Embedding>() {
            if let Some(id) = embedding.id.canonical() {
                let label = labels::for_embedding(embedding.target);
                match embedding.target {
                    EmbeddingKind::File => message.attachments.push(id.to_string()),
                    EmbeddingKind::Message => message.citations.push(id.to_string()),
                }
                edits.push((node.span, label));
            }
        } else if let Some(link) = node.payload::<Link>()
            && let Some(target) = self.links.classify(&link.destination)
        {
            let label = labels::for_target(&target);
            match target {
                Target::File { id } => message.attachments.push(id),
                Target::Message { id } => message.citations.push(id),
            }
            // Explicit labels and reference definitions retain their Markdown source.
            // Bare and angle-bracket links are the source notation for embedded URLs.
            if link.form != LinkForm::Explicit {
                let raw = &source[node.span.start..node.span.end];
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
    }
}

pub(crate) struct Collector<'a, 'policy> {
    policy: &'policy Extractor,
    message: Message,
    edits: Vec<(Span, &'a str)>,
}

impl<'a, 'policy> Collector<'a, 'policy> {
    pub(crate) fn new(policy: &'policy Extractor) -> Self {
        Self {
            policy,
            message: Message::default(),
            edits: vec![],
        }
    }
    pub(crate) fn finish(mut self, source: &str) -> crate::Result<Message> {
        self.message.source_text = crate::edits::apply(source, self.edits)?;
        Ok(self.message)
    }
}

impl<'a> markdown_extractor::Collector<'a> for Collector<'a, '_> {
    type Scope = ();
    type Error = crate::Error;
    fn initial(&self) {}
    fn observe(
        &mut self,
        context: markdown_extractor::AnalysisContext<'a>,
        _: &(),
    ) -> crate::Result<()> {
        let (node, source) = (context.visit.node, context.source);
        self.policy
            .observe(node, source, &mut self.message, &mut self.edits);
        Ok(())
    }
}
