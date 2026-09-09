pub(crate) fn export(
    config: &ts_rs::Config,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    use markdown_definitions::NodeType;

    let mut nodes = serde_json::Map::new();
    macro_rules! register {
        ($group:literal, $module:ident, $($ty:ident),* $(,)?) => {
            $(
                <$module::$ty as ts_rs::TS>::export_all(config)?;
                let key = <$module::$ty>::type_key();
                let schema = schemars::generate::SchemaSettings::default()
                    .with(|settings| {
                        settings.contract = schemars::generate::Contract::Serialize
                    })
                    .into_generator()
                    .into_root_schema_for::<$module::$ty>();
                if nodes
                    .insert(key, serde_json::json!({"group": $group, "schema": schema}))
                    .is_some()
                {
                    return Err("duplicate node type key".into());
                }
            )*
        };
    }

    node_types!(register);

    Ok(nodes.into())
}
