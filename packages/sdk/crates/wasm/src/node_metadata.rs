pub(crate) fn export() -> Result<serde_json::Value, Box<dyn std::error::Error>> {
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
                    .insert(key.into(), serde_json::json!({"group": $group, "schema": schema}))
                    .is_some()
                {
                    return Err("duplicate node type key".into());
                }
            )*
        };
    }

    selected_node_catalogs!(register);

    Ok(nodes.into())
}
