use markdown_definitions::NodeType;
use markdown_trap_contracts::*;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let directory = std::env::args().nth(1).ok_or("Pass the output directory")?;
    let config = ts_rs::Config::default()
        .with_out_dir(&directory)
        .with_import_extension(Some("js"));

    let mut nodes = serde_json::Map::new();

    macro_rules! register {
        ($($ty:ident),*) => {
            $(
                <$ty as ts_rs::TS>::export_all(&config)?;
                let schema = schemars::generate::SchemaSettings::default()
                    .with(|settings| {
                        settings.contract = schemars::generate::Contract::Serialize
                    })
                    .into_generator()
                    .into_root_schema_for::<$ty>();
                nodes.insert(
                    $ty::type_key(),
                    serde_json::json!({"group": "trap", "schema": schema}),
                );
            )*
        };
    }

    register!(
        StampData,
        ReferenceData,
        EmbeddingData,
        SpoilerData,
        BlankLineData
    );

    std::fs::create_dir_all(&directory)?;
    std::fs::write(
        std::path::Path::new(&directory).join("contracts.json"),
        serde_json::to_vec_pretty(&serde_json::json!({"nodes":nodes}))?,
    )?;

    Ok(())
}
