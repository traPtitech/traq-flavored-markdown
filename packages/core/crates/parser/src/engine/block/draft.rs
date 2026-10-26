use crate::engine::ParseState;
use crate::{AnyPayload, Span, engine::source::SourceView};

/// A block body remains here until all reference definitions have been collected.
/// Draft nodes are never serialized and cannot appear in the public AST.
pub struct DraftNode {
    pub span: Span,
    pub payload: AnyPayload,
    pub content: DraftContent,
    pub finish: Option<fn(&mut ResolvedBlock)>,
}

pub enum DraftContent {
    Leaf,
    Inline(SourceView),
    Nodes(Vec<DraftNode>),
    Blocks(SourceView),
}

impl DraftNode {
    pub fn new(span: Span, payload: AnyPayload, content: DraftContent) -> Self {
        Self {
            span,
            payload,
            content,
            finish: None,
        }
    }

    pub fn leaf(span: Span, payload: AnyPayload) -> Self {
        Self::new(span, payload, DraftContent::Leaf)
    }

    pub fn inline(span: Span, payload: AnyPayload, source: SourceView) -> Self {
        Self::new(span, payload, DraftContent::Inline(source))
    }

    pub fn nodes(span: Span, payload: AnyPayload, nodes: Vec<Self>) -> Self {
        Self::new(span, payload, DraftContent::Nodes(nodes))
    }

    pub fn blocks(span: Span, payload: AnyPayload, source: SourceView) -> Self {
        Self::new(span, payload, DraftContent::Blocks(source))
    }
}

/// Block children are fully resolved before inline rules can observe definitions.
pub struct ResolvedBlock {
    pub span: Span,
    pub payload: AnyPayload,
    pub content: ResolvedContent,
    pub metadata: ParseState,
}

pub enum ResolvedContent {
    Leaf,
    Inline(SourceView),
    Nodes(Vec<ResolvedBlock>),
}

impl ResolvedBlock {
    pub fn children(&self) -> &[ResolvedBlock] {
        match &self.content {
            ResolvedContent::Nodes(children) => children,
            _ => &[],
        }
    }
}
