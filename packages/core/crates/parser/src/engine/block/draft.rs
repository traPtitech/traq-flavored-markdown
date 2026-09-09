use super::BlockBatch;
use crate::{NodeKind, Span, engine::source::SourceView};

/// A block body remains here until all reference definitions have been collected.
/// Draft nodes are never serialized and cannot appear in the public AST.
pub struct DraftNode {
    pub span: Span,
    pub kind: NodeKind,
    pub content: DraftContent,
    pub(crate) loose: bool,
    pub finish: Option<fn(&mut DraftNode)>,
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
            loose: false,
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

    pub fn children(&self) -> &[DraftNode] {
        match &self.content {
            DraftContent::Nodes(nodes) => nodes,
            _ => &[],
        }
    }

    pub fn is_loose(&self) -> bool {
        self.loose
    }

    pub(crate) fn resolve_blocks(&mut self, batch: BlockBatch) {
        self.loose = batch.loose;
        self.content = DraftContent::Nodes(batch.nodes);
    }
}
