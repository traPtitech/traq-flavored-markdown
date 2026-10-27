use crate::{Node, NodeData, NodeRole, PayloadError};
use std::{
    any::{Any, TypeId},
    borrow::Cow,
    sync::Arc,
};

type ArityAccessor = dyn Fn(&dyn Any) -> Result<usize, PayloadError> + Send + Sync;

/// A payload field whose length constrains each child's number of children.
/// The native accessor and exported field name describe the same relationship.
#[derive(Clone)]
pub struct ChildArity {
    pub field: &'static str,
    length: Arc<ArityAccessor>,
}
impl ChildArity {
    pub fn new<T: NodeData>(field: &'static str, length: fn(&T) -> usize) -> Self {
        Self {
            field,
            length: Arc::new(move |payload| {
                let payload = payload.downcast_ref::<T>().ok_or_else(|| {
                    PayloadError::new("payload matching the child arity accessor")
                        .actual(format!("payload is not {}", std::any::type_name::<T>()))
                })?;
                Ok(length(payload))
            }),
        }
    }
}
impl std::fmt::Debug for ChildArity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ChildArity")
            .field("field", &self.field)
            .finish_non_exhaustive()
    }
}

/// A native payload identity. Distribution exporters resolve this through their
/// contract registry; the AST does not depend on persisted wire names.
#[derive(Clone, Copy)]
pub struct PayloadType {
    id: fn() -> TypeId,
    name: fn() -> &'static str,
}
impl PayloadType {
    pub const fn of<T: NodeData>() -> Self {
        Self {
            id: TypeId::of::<T>,
            name: std::any::type_name::<T>,
        }
    }
    pub fn id(self) -> TypeId {
        (self.id)()
    }
    pub fn name(self) -> &'static str {
        (self.name)()
    }
    fn matches(self, node: &Node) -> bool {
        self.id() == node.payload_type_id()
    }
}
impl std::fmt::Debug for PayloadType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PayloadType")
            .field("id", &self.id())
            .field("name", &self.name())
            .finish()
    }
}

#[derive(Clone, Debug)]
pub struct NodeStructure {
    pub role: NodeRole,
    pub children: ChildStructure,
}

/// Declarative immediate-child invariants shared by native and host validators.
#[derive(Clone, Debug)]
pub enum ChildStructure {
    Any,
    Leaf,
    Roles {
        roles: Cow<'static, [NodeRole]>,
        nonempty: bool,
    },
    Types {
        types: Cow<'static, [PayloadType]>,
        nonempty: bool,
    },
    Sequence {
        prefix: Vec<PayloadType>,
        rest: PayloadType,
        child_arity: Option<ChildArity>,
    },
}

impl NodeStructure {
    /// Explicitly opt an opaque payload into unrestricted children.
    pub const fn opaque() -> Self {
        Self {
            role: NodeRole::Opaque,
            children: ChildStructure::Any,
        }
    }

    pub const fn leaf(role: NodeRole) -> Self {
        Self {
            role,
            children: ChildStructure::Leaf,
        }
    }
    pub fn roles(role: NodeRole, child: NodeRole) -> Self {
        Self {
            role,
            children: ChildStructure::Roles {
                roles: vec![child].into(),
                nonempty: false,
            },
        }
    }
    pub fn children<T: NodeData>(role: NodeRole, nonempty: bool) -> Self {
        Self {
            role,
            children: ChildStructure::Types {
                types: vec![PayloadType::of::<T>()].into(),
                nonempty,
            },
        }
    }
    /// Validate immediate children. An arity accessor for a different payload
    /// type returns a payload error.
    pub fn validate(&self, payload: &dyn Any, children: &[Node]) -> Result<(), PayloadError> {
        let required = match &self.children {
            ChildStructure::Roles { nonempty, .. } | ChildStructure::Types { nonempty, .. } => {
                *nonempty
            }
            _ => false,
        };
        if required && children.is_empty() {
            return Err(PayloadError::new("at least one child").actual("0 children"));
        }
        match &self.children {
            ChildStructure::Any => Ok(()),
            ChildStructure::Leaf if !children.is_empty() => {
                Err(PayloadError::new("no children").actual(format!("{} children", children.len())))
            }
            ChildStructure::Leaf => Ok(()),
            ChildStructure::Roles { roles, .. } => {
                for (index, child) in children.iter().enumerate() {
                    if !roles.contains(&child.role()) {
                        return Err(PayloadError::new("children with allowed roles").actual(
                            format!("child {index}: {:?}; expected {roles:?}", child.role()),
                        ));
                    }
                }
                Ok(())
            }
            ChildStructure::Types { types, .. } => {
                for (index, child) in children.iter().enumerate() {
                    if !types.iter().any(|kind| kind.matches(child)) {
                        return Err(PayloadError::new("children with allowed payload types")
                            .actual(format!("child {index}: {}", child.payload_type_name())));
                    }
                }
                Ok(())
            }
            ChildStructure::Sequence {
                prefix,
                rest,
                child_arity,
            } => {
                if children.len() < prefix.len() {
                    return Err(PayloadError::new("complete child sequence prefix").actual(
                        format!(
                            "{} children; expected at least {}",
                            children.len(),
                            prefix.len()
                        ),
                    ));
                }
                let arity = child_arity
                    .as_ref()
                    .map(|arity| (arity.length)(payload))
                    .transpose()?;
                if arity == Some(0) {
                    return Err(PayloadError::new("positive child arity"));
                }
                for (index, child) in children.iter().enumerate() {
                    let expected = prefix.get(index).unwrap_or(rest);
                    if !expected.matches(child) {
                        return Err(PayloadError::new("children matching the declared sequence")
                            .actual(format!("child {index}: {}", child.payload_type_name())));
                    }
                    if let Some(arity) = arity
                        && child.children.len() != arity
                    {
                        return Err(
                            PayloadError::new("child arity equal to payload field length").actual(
                                format!(
                                    "child {index}: {} children; expected {arity}",
                                    child.children.len()
                                ),
                            ),
                        );
                    }
                }
                Ok(())
            }
        }
    }
}
