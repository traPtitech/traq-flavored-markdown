use crate::{Node, NodeData, NodeRole, PayloadError};
use std::any::TypeId;

/// A native payload identity. Distribution exporters resolve this through their
/// contract registry; the AST does not depend on persisted wire names.
#[derive(Clone, Copy, Debug)]
pub struct PayloadType {
    pub id: fn() -> TypeId,
    pub name: &'static str,
}
impl PayloadType {
    pub fn of<T: NodeData>() -> Self {
        Self {
            id: TypeId::of::<T>,
            name: std::any::type_name::<T>(),
        }
    }
    fn matches(self, node: &Node) -> bool {
        (self.id)() == node.data_type_id()
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
        roles: Vec<NodeRole>,
        nonempty: bool,
    },
    Types {
        types: Vec<PayloadType>,
        nonempty: bool,
    },
    Table {
        header: PayloadType,
        row: PayloadType,
        columns_field: &'static str,
    },
}

impl NodeStructure {
    pub fn leaf(role: NodeRole) -> Self {
        Self {
            role,
            children: ChildStructure::Leaf,
        }
    }
    pub fn roles(role: NodeRole, child: NodeRole) -> Self {
        Self {
            role,
            children: ChildStructure::Roles {
                roles: vec![child],
                nonempty: false,
            },
        }
    }
    pub fn children<T: NodeData>(role: NodeRole, nonempty: bool) -> Self {
        Self {
            role,
            children: ChildStructure::Types {
                types: vec![PayloadType::of::<T>()],
                nonempty,
            },
        }
    }
    pub fn validate(&self, children: &[Node], columns: Option<usize>) -> Result<(), PayloadError> {
        let required = match &self.children {
            ChildStructure::Roles { nonempty, .. } | ChildStructure::Types { nonempty, .. } => {
                *nonempty
            }
            ChildStructure::Table { .. } => true,
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
                            .actual(format!("child {index}: {}", child.data_type_name())));
                    }
                }
                Ok(())
            }
            ChildStructure::Table { header, row, .. } => {
                let columns = columns
                    .filter(|value| *value > 0)
                    .ok_or_else(|| PayloadError::new("at least one table column"))?;
                for (index, child) in children.iter().enumerate() {
                    let expected = if index == 0 { header } else { row };
                    if !expected.matches(child) {
                        return Err(
                            PayloadError::new("initial header row followed by body rows")
                                .actual(format!("child {index}: {}", child.data_type_name())),
                        );
                    }
                    if child.children.len() != columns {
                        return Err(
                            PayloadError::new("row width equal to table columns").actual(format!(
                                "row {index}: {} cells; expected {columns}",
                                child.children.len()
                            )),
                        );
                    }
                }
                Ok(())
            }
        }
    }
}
