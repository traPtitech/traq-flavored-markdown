fn main() -> Result<(), Box<dyn std::error::Error>> {
    let directory = std::env::args().nth(1).ok_or("Pass the output directory")?;
    let mut nodes = serde_json::Map::new();

    macro_rules! register {
        ($group:literal; $($payload:ty => $kind:literal),+ $(,)?) => {
            $(
                let schema = schemars::generate::SchemaSettings::default()
                    .with(|settings| settings.contract = schemars::generate::Contract::Serialize)
                    .into_generator()
                    .into_root_schema_for::<$payload>();
                if nodes.insert(
                    $kind.into(),
                    serde_json::json!({"group": $group, "schema": schema}),
                ).is_some() {
                    return Err("duplicate node wire kind".into());
                }
            )+
        };
    }
    markdown_trap_contracts::node_catalog!(register);

    std::fs::create_dir_all(&directory)?;
    std::fs::write(
        std::path::Path::new(&directory).join("contracts.json"),
        serde_json::to_vec_pretty(&serde_json::json!({"nodes": nodes}))?,
    )?;
    Ok(())
}
