//! traQ editing policy over a parsed document. Identity lookup belongs to the caller.
use markdown_ast::{Node, Span};
use markdown_commonmark_contracts::{Image, Link, Text};
use markdown_traq_contracts::{Embedding, Reference, ReferenceKind};
use serde::Serialize;

#[derive(Debug, PartialEq, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReferenceEmbeddingCandidate {
    /// UTF-8 byte offsets into the original source, not rendered text.
    pub start: u32,
    pub end: u32,
    pub raw: String,
    pub name: String,
    pub kind: ReferenceKind,
}

#[derive(Debug, Default, PartialEq, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReferenceEmbeddingPlan {
    /// Ordered lookup attempts. A successful attempt consumes its source range.
    pub candidates: Vec<ReferenceEmbeddingCandidate>,

    /// Original Markdown with recognized reference nodes restored to their labels.
    pub unembedded_text: String,
}

/// Reuse an immutable validation, including explicitly configured tree limits.
pub fn plan<'a>(
    document: impl markdown_ast::DocumentInput<'a>,
) -> crate::Result<ReferenceEmbeddingPlan> {
    let document = document.into_view()?;
    let mut collector = Collector::default();
    markdown_extractor::collect(document, &mut collector)?;
    collector.finish(&document.document().source)
}

#[derive(Default)]
pub(crate) struct Collector<'a> {
    plan: ReferenceEmbeddingPlan,
    edits: Vec<(Span, &'a str)>,
}
impl Collector<'_> {
    pub(crate) fn finish(self, source: &str) -> crate::Result<ReferenceEmbeddingPlan> {
        finish(source, self.plan, self.edits)
    }
}
impl<'a> markdown_extractor::Collector<'a> for Collector<'a> {
    type Scope = bool;
    type Error = crate::Error;
    fn initial(&self) -> bool {
        true
    }
    fn observe(
        &mut self,
        context: markdown_extractor::AnalysisContext<'a>,
        allow_embedding: &bool,
    ) -> crate::Result<bool> {
        Ok(observe(
            context.visit.node,
            context.source,
            *allow_embedding,
            &mut self.plan,
            &mut self.edits,
        ))
    }
}

pub(crate) fn observe<'a>(
    node: &'a Node,
    source: &str,
    allow_embedding: bool,
    result: &mut ReferenceEmbeddingPlan,
    edits: &mut Vec<(Span, &'a str)>,
) -> bool {
    if let Some(reference) = node.payload::<Reference>() {
        edits.push((node.span, reference.label.as_str()));
    } else if let Some(embedding) = node.payload::<Embedding>() {
        edits.push((node.span, embedding.label.as_str()));
    } else if allow_embedding && node.payload::<Text>().is_some() {
        collect(
            source,
            node.span.start,
            node.span.end,
            &mut result.candidates,
        );
    }

    // Restore existing references in labels, but never look up new names inside links or images.
    allow_embedding && node.payload::<Link>().is_none() && node.payload::<Image>().is_none()
}

pub(crate) fn finish(
    source: &str,
    mut result: ReferenceEmbeddingPlan,
    edits: Vec<(Span, &str)>,
) -> crate::Result<ReferenceEmbeddingPlan> {
    result.unembedded_text = crate::edits::apply(source, edits)?;
    result.candidates.sort_by_key(|candidate| candidate.start);
    exclude_url_candidates(source, &mut result.candidates);
    Ok(result)
}

// Bare URLs are ordinary Markdown text, but replacing their fragments or path
// components with references would corrupt them. Inspect the original tokens
// so this protection also covers URLs split across formatting nodes.
fn exclude_url_candidates(source: &str, candidates: &mut Vec<ReferenceEmbeddingCandidate>) {
    if candidates.is_empty() {
        return;
    }
    let mut offset = 0;
    let mut urls = Vec::new();
    for token in source.split_inclusive(char::is_whitespace) {
        let value = token
            .trim_end_matches(char::is_whitespace)
            .trim_start_matches(['(', '[', '{', '<', '>', '\'', '"', '*', '_', '~', '!', '=']);
        if let Some(start) = url_start(value) {
            let base = offset + token.find(value).unwrap();
            let end = value[start..]
                .find(['<', '>'])
                .map_or(value.len(), |end| start + end);
            urls.push(base + start..base + end);
        }
        offset += token.len();
    }
    let mut urls = urls.into_iter().peekable();
    candidates.retain(|candidate| {
        let position = candidate.start as usize;
        while urls.peek().is_some_and(|range| range.end <= position) {
            urls.next();
        }
        urls.peek().is_none_or(|range| !range.contains(&position))
    });
}

fn url_start(value: &str) -> Option<usize> {
    for (position, _) in value.char_indices() {
        if ["http://", "https://", "ftp://"].iter().any(|prefix| {
            value
                .get(position..position + prefix.len())
                .is_some_and(|start| start.eq_ignore_ascii_case(prefix))
        }) && value[..position]
            .chars()
            .next_back()
            .is_none_or(|ch| !ch.is_ascii_alphanumeric() && !"+-".contains(ch))
        {
            return Some(position);
        }
    }
    let value = value.strip_prefix("//").unwrap_or(value);
    let end = value.find(['/', '?', '#'])?;
    let authority = &value[..end];
    let host = authority.split(':').next().unwrap();
    (host.contains('.')
        && host.split('.').all(|part| {
            !part.is_empty() && part.chars().all(|ch| ch.is_alphanumeric() || ch == '-')
        }))
    .then_some(0)
}

fn collect(source: &str, start: usize, end: usize, result: &mut Vec<ReferenceEmbeddingCandidate>) {
    let text = &source[start..end];
    let mut escaped = false;

    for (offset, marker) in text.char_indices() {
        if escaped {
            escaped = false;
            continue;
        }

        if marker == '\\' {
            escaped = true;
            continue;
        }

        if !matches!(marker, '@' | '＠' | '#' | '＃') {
            continue;
        }

        let position = start + offset;
        let name_start = position + marker.len_utf8();
        let tail = &source[name_start..end];

        if matches!(marker, '#' | '＃') {
            // A numeric HTML entity remains authored text, not a channel name.
            if source[..position].ends_with('&') {
                continue;
            }

            let length = tail
                .bytes()
                .take_while(|c| c.is_ascii_alphanumeric() || matches!(c, b'_' | b'-' | b'/'))
                .count();

            if length > 0 {
                push(
                    source,
                    position,
                    name_start,
                    name_start + length,
                    ReferenceKind::Channel,
                    result,
                );
            }

            continue;
        }

        if source[..position].ends_with(':') {
            continue;
        }

        // Name grammar only: Markdown boundaries were determined by the parser.
        let length = tail
            .chars()
            .take_while(|c| !c.is_whitespace() && !matches!(c, '@' | '＠' | '.'))
            .take(32)
            .map(char::len_utf8)
            .sum::<usize>();

        if tail[length..].starts_with('.') {
            continue;
        }

        let name = tail[..length].trim_end_matches(':');
        if name.is_empty() {
            continue;
        }

        let name_end = name_start + name.len();
        push(
            source,
            position,
            name_start,
            name_end,
            ReferenceKind::User,
            result,
        );
        push(
            source,
            position,
            name_start,
            name_end,
            ReferenceKind::Group,
            result,
        );

        let prefix = name
            .bytes()
            .take_while(|c| c.is_ascii_alphanumeric() || matches!(c, b'_' | b'-'))
            .count();

        if prefix > 0 && prefix < name.len() {
            push(
                source,
                position,
                name_start,
                name_start + prefix,
                ReferenceKind::User,
                result,
            );
        }
    }
}

fn push(
    source: &str,
    start: usize,
    name_start: usize,
    end: usize,
    kind: ReferenceKind,
    result: &mut Vec<ReferenceEmbeddingCandidate>,
) {
    result.push(ReferenceEmbeddingCandidate {
        start: start as u32,
        end: end as u32,
        raw: source[start..end].into(),
        name: source[name_start..end].to_lowercase(),
        kind,
    });
}
