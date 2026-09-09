use crate::{NodeData, NodeKind, Span};

#[derive(Debug, Clone, PartialEq)]
pub struct Node {
    pub span: Span,
    pub kind: NodeKind,
    pub children: Vec<Node>,
}

impl Node {
    pub fn new(span: Span, data: impl Into<NodeKind>, children: Vec<Node>) -> Self {
        Self {
            span,
            kind: data.into(),
            children,
        }
    }

    pub fn leaf(span: Span, data: impl Into<NodeKind>) -> Self {
        Self::new(span, data, vec![])
    }

    pub fn get<T: NodeData>(&self) -> Option<&T> {
        self.kind.get()
    }

    pub fn get_mut<T: NodeData>(&mut self) -> Option<&mut T> {
        self.kind.get_mut()
    }

    pub fn data_type_id(&self) -> std::any::TypeId {
        self.kind.data_type_id()
    }

    /// Calls only this node's type-owned check. Does not validate descendants or spans.
    pub fn validate(&self) -> bool {
        self.kind.validate(&self.children)
    }
}
