use markdown_ast::{ChildStructure, NodeRole, NodeStructure};
use serde::Serialize;
use std::{any::TypeId, collections::HashMap};

#[derive(Debug, Serialize)]
pub struct StructureContract {
    role: &'static str,
    children: ChildContract,
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum ChildContract {
    Any,
    Leaf,
    Roles {
        roles: Vec<&'static str>,
        nonempty: bool,
    },
    Types {
        types: Vec<String>,
        nonempty: bool,
    },
    Sequence {
        prefix: Vec<String>,
        rest: String,
        #[serde(rename = "arityField", skip_serializing_if = "Option::is_none")]
        arity_field: Option<&'static str>,
    },
}

fn role(value: NodeRole) -> &'static str {
    match value {
        NodeRole::Block => "block",
        NodeRole::Inline => "inline",
        NodeRole::Structural => "structural",
        NodeRole::Opaque => "opaque",
    }
}

pub fn export(
    value: &NodeStructure,
    names: &HashMap<TypeId, String>,
) -> crate::Result<StructureContract> {
    let name = |payload: &markdown_ast::PayloadType| {
        names
            .get(&payload.id())
            .cloned()
            .ok_or_else(|| format!("unregistered structural payload: {}", payload.name()))
    };
    let children = match &value.children {
        ChildStructure::Any => ChildContract::Any,
        ChildStructure::Leaf => ChildContract::Leaf,
        ChildStructure::Roles { roles, nonempty } => ChildContract::Roles {
            roles: roles.iter().copied().map(role).collect(),
            nonempty: *nonempty,
        },
        ChildStructure::Types { types, nonempty } => ChildContract::Types {
            types: types.iter().map(name).collect::<Result<_, _>>()?,
            nonempty: *nonempty,
        },
        ChildStructure::Sequence {
            prefix,
            rest,
            child_arity,
        } => ChildContract::Sequence {
            prefix: prefix.iter().map(name).collect::<Result<_, _>>()?,
            rest: name(rest)?,
            arity_field: child_arity.as_ref().map(|arity| arity.field),
        },
    };
    Ok(StructureContract {
        role: role(value.role),
        children,
    })
}
