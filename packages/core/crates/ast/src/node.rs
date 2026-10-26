use crate::{AnyPayload, NodeData, NodeRole, Span};

#[derive(Debug, Clone, PartialEq)]
pub struct Node {
    pub span: Span,
    pub payload: AnyPayload,
    pub children: Vec<Node>,
}

impl Node {
    pub fn new(span: Span, data: impl Into<AnyPayload>, children: Vec<Node>) -> Self {
        Self {
            span,
            payload: data.into(),
            children,
        }
    }

    pub fn leaf(span: Span, data: impl Into<AnyPayload>) -> Self {
        Self::new(span, data, vec![])
    }

    pub fn payload<T: NodeData>(&self) -> Option<&T> {
        self.payload.downcast_ref()
    }

    pub fn payload_mut<T: NodeData>(&mut self) -> Option<&mut T> {
        self.payload.downcast_mut()
    }

    pub fn payload_type_id(&self) -> std::any::TypeId {
        self.payload.payload_type_id()
    }

    pub fn payload_type_name(&self) -> &'static str {
        self.payload.payload_type_name()
    }

    pub fn role(&self) -> NodeRole {
        self.payload.role()
    }

    pub fn payload_bytes(&self) -> usize {
        self.payload.payload_bytes()
    }

    /// Calls only this node's type-owned check. Does not validate descendants or spans.
    pub fn validate(&self) -> Result<(), crate::PayloadError> {
        self.payload.validate(&self.children)
    }
}
