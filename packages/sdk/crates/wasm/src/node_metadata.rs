pub(crate) fn export() -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    use markdown_ast::NodeData;
    let mut type_names = std::collections::HashMap::new();
    macro_rules! identities {
        ($group:literal; $($ty:ty => $kind:literal),+ $(,)?) => {
            $(type_names.insert(std::any::TypeId::of::<$ty>(), $kind);)*
        };
    }
    selected_node_catalogs!(identities);
    let mut nodes = serde_json::Map::new();
    macro_rules! register {
        ($group:literal; $($ty:ty => $kind:literal),+ $(,)?) => {
            $(
                let key = $kind;
                let schema = schemars::generate::SchemaSettings::default()
                    .with(|settings| {
                        settings.contract = schemars::generate::Contract::Serialize
                    })
                    .into_generator()
                    .into_root_schema_for::<$ty>();
                if nodes
                    .insert(key.into(), serde_json::json!({"group": $group, "schema": schema, "structure": structure(<$ty>::structure(), &type_names)?}))
                    .is_some()
                {
                    return Err("duplicate node type key".into());
                }
            )*
        };
    }

    selected_node_catalogs!(register);

    let expected: std::collections::HashSet<_> = traq_markdown_features::all()
        .iter()
        .flat_map(|feature| feature.payloads.iter().map(|payload| payload.kind.as_str()))
        .collect();
    let actual: std::collections::HashSet<_> = nodes.keys().map(String::as_str).collect();
    if actual != expected {
        return Err("SDK feature payloads and exported node contracts differ".into());
    }

    Ok(nodes.into())
}

#[path = "../../../../../scripts/codegen/structure.rs"]
mod structural_metadata;
use structural_metadata::structure;
