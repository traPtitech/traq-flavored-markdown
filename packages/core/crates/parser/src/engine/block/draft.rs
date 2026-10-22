use crate::engine::ParseState;
use crate::{NodeKind, Span, engine::source::SourceView};

/// A block body remains here until all reference definitions have been collected.
/// Draft nodes are never serialized and cannot appear in the public AST.
pub struct DraftNode {
    pub span: Span,
    pub kind: NodeKind,
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
    pub fn new(span: Span, kind: NodeKind, content: DraftContent) -> Self {
        Self {
            span,
            kind,
            content,
            finish: None,
        }
    }

    pub fn leaf(span: Span, kind: NodeKind) -> Self {
        Self::new(span, kind, DraftContent::Leaf)
    }

    pub fn inline(span: Span, kind: NodeKind, source: SourceView) -> Self {
        Self::new(span, kind, DraftContent::Inline(source))
    }

    pub fn nodes(span: Span, kind: NodeKind, nodes: Vec<Self>) -> Self {
        Self::new(span, kind, DraftContent::Nodes(nodes))
    }

    pub fn blocks(span: Span, kind: NodeKind, source: SourceView) -> Self {
        Self::new(span, kind, DraftContent::Blocks(source))
    }
}

/// Block children are fully resolved before inline rules can observe definitions.
pub struct ResolvedBlock {
    pub span: Span,
    pub kind: NodeKind,
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
