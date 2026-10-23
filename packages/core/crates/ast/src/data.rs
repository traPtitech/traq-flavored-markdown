use crate::{ChildStructure, Node, NodeStructure};
use std::{
    any::{Any, TypeId},
    fmt::Debug,
};

/// A node's placement in Markdown containers. Structural nodes belong to
/// dedicated containers, such as list items and table rows.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NodeRole {
    Block,
    Inline,
    Structural,
    Opaque,
}

/// A concrete payload, defined and validated by its owning contract package.
pub trait NodeData: Any + Clone + PartialEq + Debug + Send + Sync {
    /// Count bytes owned by this payload, including all dynamic string fields.
    /// Every payload implementation must account for its own heap content.
    fn payload_bytes(&self) -> usize;

    /// Structural metadata is shared with distribution exporters. Custom opaque
    /// payloads may opt into unrestricted children.
    fn structure() -> &'static NodeStructure {
        static STRUCTURE: NodeStructure = NodeStructure {
            role: NodeRole::Opaque,
            children: ChildStructure::Any,
        };
        &STRUCTURE
    }

    /// Additional payload invariants, including semantic relationships with
    /// immediate children. Structural validation always runs before this hook.
    fn validate_payload(&self, _children: &[Node]) -> Result<(), PayloadError> {
        Ok(())
    }
}

/// A payload-owned invariant, preserved with tree location by document validation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PayloadError {
    pub expected: &'static str,
    pub actual: Option<String>,
}

impl PayloadError {
    pub fn new(expected: &'static str) -> Self {
        Self {
            expected,
            actual: None,
        }
    }

    pub fn actual(mut self, value: impl Into<String>) -> Self {
        self.actual = Some(value.into());
        self
    }
}

trait Payload: Debug + Send + Sync {
    fn any(&self) -> &dyn Any;
    fn any_mut(&mut self) -> &mut dyn Any;
    fn copy(&self) -> Box<dyn Payload>;
    fn equals(&self, other: &dyn Payload) -> bool;
    fn validate(&self, children: &[Node]) -> Result<(), PayloadError>;
    fn type_name(&self) -> &'static str;
    fn role(&self) -> NodeRole;
    fn payload_bytes(&self) -> usize;
}

impl<T: NodeData> Payload for T {
    fn any(&self) -> &dyn Any {
        self
    }

    fn any_mut(&mut self) -> &mut dyn Any {
        self
    }

    fn copy(&self) -> Box<dyn Payload> {
        Box::new(self.clone())
    }

    fn equals(&self, other: &dyn Payload) -> bool {
        other.any().downcast_ref::<T>() == Some(self)
    }

    fn validate(&self, children: &[Node]) -> Result<(), PayloadError> {
        T::structure().validate(self, children)?;
        self.validate_payload(children)
    }

    fn type_name(&self) -> &'static str {
        std::any::type_name::<T>()
    }

    fn role(&self) -> NodeRole {
        T::structure().role
    }

    fn payload_bytes(&self) -> usize {
        NodeData::payload_bytes(self)
    }
}

/// An owned, type-erased payload, also usable before a parser has built children.
/// This is an open container, not an enum of Markdown node kinds.
#[derive(Debug)]
pub struct NodeKind(Box<dyn Payload>);
impl NodeKind {
    pub fn new<T: NodeData>(data: T) -> Self {
        Self(Box::new(data))
    }

    pub fn get<T: NodeData>(&self) -> Option<&T> {
        self.0.any().downcast_ref()
    }

    pub fn get_mut<T: NodeData>(&mut self) -> Option<&mut T> {
        self.0.any_mut().downcast_mut()
    }

    /// Process-local lookup key. Never use this as a persisted contract name.
    pub fn data_type_id(&self) -> TypeId {
        self.0.any().type_id()
    }

    pub fn validate(&self, children: &[Node]) -> Result<(), PayloadError> {
        self.0.validate(children)
    }

    pub fn data_type_name(&self) -> &'static str {
        self.0.type_name()
    }

    pub fn role(&self) -> NodeRole {
        self.0.role()
    }

    pub fn payload_bytes(&self) -> usize {
        self.0.payload_bytes()
    }
}

impl<T: NodeData> From<T> for NodeKind {
    fn from(data: T) -> Self {
        Self::new(data)
    }
}

impl Clone for NodeKind {
    fn clone(&self) -> Self {
        Self(self.0.copy())
    }
}

impl PartialEq for NodeKind {
    fn eq(&self, other: &Self) -> bool {
        self.0.equals(other.0.as_ref())
    }
}
