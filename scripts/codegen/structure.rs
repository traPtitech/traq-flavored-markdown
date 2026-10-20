//! Native contract metadata shared by standalone owner exporters and the SDK.
fn role(value: markdown_ast::NodeRole) -> &'static str {
    match value {
        markdown_ast::NodeRole::Block => "block",
        markdown_ast::NodeRole::Inline => "inline",
        markdown_ast::NodeRole::Structural => "structural",
        markdown_ast::NodeRole::Opaque => "opaque",
    }
}

pub fn structure(
    value: &markdown_ast::NodeStructure,
    names: &std::collections::HashMap<std::any::TypeId, &str>,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    use markdown_ast::ChildStructure;
    let name = |payload: &markdown_ast::PayloadType| {
        names
            .get(&(payload.id)())
            .copied()
            .ok_or_else(|| format!("unregistered structural payload: {}", payload.name))
    };
    let children = match &value.children {
        ChildStructure::Any => serde_json::json!({"kind":"any"}),
        ChildStructure::Leaf => serde_json::json!({"kind":"leaf"}),
        ChildStructure::Roles { roles, nonempty } => {
            serde_json::json!({"kind":"roles","roles":roles.iter().copied().map(role).collect::<Vec<_>>(),"nonempty":nonempty})
        }
        ChildStructure::Types { types, nonempty } => {
            serde_json::json!({"kind":"types","types":types.iter().map(name).collect::<Result<Vec<_>,_>>()?,"nonempty":nonempty})
        }
        ChildStructure::Table {
            header,
            row,
            columns_field,
        } => {
            serde_json::json!({"kind":"table","header":name(header)?,"row":name(row)?,"columnsField":columns_field})
        }
    };
    Ok(serde_json::json!({"role":role(value.role),"children":children}))
}
