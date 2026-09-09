//! traQ editing policy over a parsed document. Identity lookup belongs to the caller.
use markdown_ast::{Document, ValidationLimits};
use markdown_commonmark_contracts::{Image, Link, Text};
use markdown_trap_contracts::{EmbeddingData, ReferenceData};
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum LookupKind {
    User,
    Group,
    Channel,
}

#[derive(Debug, PartialEq, Serialize)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct EmbeddingCandidate {
    /// UTF-8 byte offsets into the original source, not rendered text.
    pub start: u32,
    pub end: u32,
    pub raw: String,
    pub name: String,
    pub kind: LookupKind,
}

#[derive(Debug, Default, PartialEq, Serialize)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS, schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EmbeddingPlan {
    /// Ordered lookup attempts. A successful attempt consumes its source range.
    pub candidates: Vec<EmbeddingCandidate>,

    /// Original Markdown with recognized reference nodes restored to their labels.
    pub unembedded_text: String,
}

pub fn plan(document: &Document) -> Result<EmbeddingPlan, &'static str> {
    document
        .validate(ValidationLimits::default())
        .map_err(|_| "invalid_node")?;

    u32::try_from(document.source.len()).map_err(|_| "source_too_large")?;

    let mut result = EmbeddingPlan::default();
    let mut position = 0;
    let mut pending: Vec<_> = document
        .children
        .iter()
        .rev()
        .map(|node| (node, true))
        .collect();

    while let Some((node, allow_embedding)) = pending.pop() {
        if let Some(reference) = node.get::<ReferenceData>() {
            result
                .unembedded_text
                .push_str(&document.source[position..node.span.start]);
            result.unembedded_text.push_str(&reference.label);
            position = node.span.end;
        } else if let Some(embedding) = node.get::<EmbeddingData>() {
            result
                .unembedded_text
                .push_str(&document.source[position..node.span.start]);
            result.unembedded_text.push_str(&embedding.label);
            position = node.span.end;
        } else if allow_embedding && node.get::<Text>().is_some() {
            collect(
                &document.source,
                node.span.start,
                node.span.end,
                &mut result.candidates,
            );
        }

        // Existing references can be restored in labels; new references must not alter links or images.
        let allow_children =
            allow_embedding && node.get::<Link>().is_none() && node.get::<Image>().is_none();

        pending.extend(
            node.children
                .iter()
                .rev()
                .map(|child| (child, allow_children)),
        );
    }

    result
        .unembedded_text
        .push_str(&document.source[position..]);

    Ok(result)
}

fn collect(source: &str, start: usize, end: usize, result: &mut Vec<EmbeddingCandidate>) {
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
                    LookupKind::Channel,
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
            LookupKind::User,
            result,
        );
        push(
            source,
            position,
            name_start,
            name_end,
            LookupKind::Group,
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
                LookupKind::User,
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
    kind: LookupKind,
    result: &mut Vec<EmbeddingCandidate>,
) {
    result.push(EmbeddingCandidate {
        start: start as u32,
        end: end as u32,
        raw: source[start..end].into(),
        name: source[name_start..end].to_lowercase(),
        kind,
    });
}
