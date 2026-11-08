//! Distribution-owned wire contract for the parser's optional source facts.
use crate::abi::{Error, ErrorCode};
use markdown_parser::syntax as native;
use serde::Serialize;

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SyntaxSpan {
    pub start: u32,
    pub end: u32,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum SyntaxMarkerKind {
    Open,
    Close,
    Prefix,
    Info,
    Separator,
    Definition,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SyntaxMarker {
    pub kind: SyntaxMarkerKind,
    pub spans: Vec<SyntaxSpan>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub columns: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SourceSyntax {
    pub content: Vec<SyntaxSpan>,
    pub markers: Vec<SyntaxMarker>,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SyntaxRecords {
    /// Exactly one record per AST node, in preorder, including null facts.
    pub nodes: Vec<Option<SourceSyntax>>,
    pub detached: Vec<SyntaxMarker>,
}

fn integer(value: usize) -> Result<u32, Error> {
    value.try_into().map_err(|_| {
        Error::new(
            ErrorCode::InternalError,
            "syntax coordinate exceeds wire limits",
        )
    })
}

fn spans(values: Vec<markdown_parser::Span>) -> Result<Vec<SyntaxSpan>, Error> {
    values
        .into_iter()
        .map(|span| {
            Ok(SyntaxSpan {
                start: integer(span.start)?,
                end: integer(span.end)?,
            })
        })
        .collect()
}

fn marker(value: native::SyntaxMarker) -> Result<SyntaxMarker, Error> {
    let kind = match value.kind {
        native::MarkerKind::Open => SyntaxMarkerKind::Open,
        native::MarkerKind::Close => SyntaxMarkerKind::Close,
        native::MarkerKind::Prefix => SyntaxMarkerKind::Prefix,
        native::MarkerKind::Info => SyntaxMarkerKind::Info,
        native::MarkerKind::Separator => SyntaxMarkerKind::Separator,
        native::MarkerKind::Definition => SyntaxMarkerKind::Definition,
    };

    Ok(SyntaxMarker {
        kind,
        spans: spans(value.spans)?,
        columns: value.columns.map(integer).transpose()?,
        text: value.text,
    })
}

fn facts(value: Option<native::SourceSyntax>) -> Result<Option<SourceSyntax>, Error> {
    value
        .map(|source| {
            Ok::<_, Error>(SourceSyntax {
                content: spans(source.content)?,
                markers: source
                    .markers
                    .into_iter()
                    .map(marker)
                    .collect::<Result<_, _>>()?,
            })
        })
        .transpose()
}

impl TryFrom<native::SyntaxTree> for SyntaxRecords {
    type Error = Error;

    fn try_from(value: native::SyntaxTree) -> Result<Self, Error> {
        let mut nodes = vec![];
        let mut pending: Vec<_> = value.children.into_iter().rev().collect();

        while let Some(node) = pending.pop() {
            nodes.push(facts(node.source)?);
            pending.extend(node.children.into_iter().rev());
        }

        Ok(Self {
            nodes,
            detached: value
                .detached
                .into_iter()
                .map(marker)
                .collect::<Result<_, _>>()?,
        })
    }
}

#[derive(Serialize)]
pub struct ParsedSyntaxReply<'a> {
    pub document: markdown_codec::SerializableDocument<'a>,
    pub syntax: SyntaxRecords,
}
