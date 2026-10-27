use crate::{Node, NodeStructure};
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
/// Every payload must explicitly declare its structural contract.
///
/// Shared access and cloning must preserve the structural contract, payload
/// validity, and logical byte count. Checked documents reuse those validation
/// facts, so interior mutability must not invalidate them.
///
/// ```compile_fail
/// #[derive(Debug, Clone, PartialEq)]
/// struct MissingStructure;
/// impl markdown_ast::NodeData for MissingStructure {
///     fn payload_bytes(&self) -> usize { 0 }
/// }
/// ```
pub trait NodeData: Any + Clone + PartialEq + Debug + Send + Sync {
    /// Count logical bytes in this payload's populated dynamic fields.
    /// Include string contents and populated collection storage, excluding spare
    /// capacity and allocation overhead. This is a payload budget, not a bound
    /// on the allocator's retained memory.
    fn payload_bytes(&self) -> usize;

    /// Structural metadata shared with distribution exporters. Use
    /// `NodeStructure::opaque()` to explicitly allow unrestricted children.
    fn structure() -> &'static NodeStructure;

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

    #[must_use]
    pub fn actual(mut self, value: impl Into<String>) -> Self {
        self.actual = Some(value.into());
        self
    }
}

impl std::fmt::Display for PayloadError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "expected {}", self.expected)?;
        if let Some(actual) = &self.actual {
            write!(f, ", got {actual}")?;
        }
        Ok(())
    }
}

impl std::error::Error for PayloadError {}

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
pub struct AnyPayload(Box<dyn Payload>);
impl AnyPayload {
    pub fn new<T: NodeData>(data: T) -> Self {
        Self(Box::new(data))
    }

    pub fn downcast_ref<T: NodeData>(&self) -> Option<&T> {
        self.0.any().downcast_ref()
    }

    pub fn downcast_mut<T: NodeData>(&mut self) -> Option<&mut T> {
        self.0.any_mut().downcast_mut()
    }

    /// Process-local lookup key. Never use this as a persisted contract name.
    pub fn payload_type_id(&self) -> TypeId {
        self.0.any().type_id()
    }

    pub fn validate(&self, children: &[Node]) -> Result<(), PayloadError> {
        self.0.validate(children)
    }

    pub fn payload_type_name(&self) -> &'static str {
        self.0.type_name()
    }

    pub fn role(&self) -> NodeRole {
        self.0.role()
    }

    pub fn payload_bytes(&self) -> usize {
        self.0.payload_bytes()
    }
}

impl<T: NodeData> From<T> for AnyPayload {
    fn from(data: T) -> Self {
        Self::new(data)
    }
}

impl Clone for AnyPayload {
    fn clone(&self) -> Self {
        Self(self.0.copy())
    }
}

impl PartialEq for AnyPayload {
    fn eq(&self, other: &Self) -> bool {
        self.0.equals(other.0.as_ref())
    }
}
