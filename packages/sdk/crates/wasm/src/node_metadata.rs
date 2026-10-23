pub(crate) fn export() -> markdown_contract_export::Result<markdown_contract_export::NodeManifest> {
    let mut exporter = markdown_contract_export::NodeExporter::default();
    macro_rules! register {
        ($group:literal; $($ty:ty => $kind:literal),+ $(,)?) => {
            $(exporter.register::<$ty>($group, $kind)?;)*
        };
    }
    selected_node_catalogs!(register);
    let manifest = exporter.finish()?;
    let expected: std::collections::HashSet<_> = traq_markdown_features::all()
        .iter()
        .flat_map(|feature| {
            feature
                .contract
                .payloads
                .iter()
                .map(|payload| payload.kind.as_str())
        })
        .collect();
    let actual: std::collections::HashSet<_> = manifest.nodes.keys().map(String::as_str).collect();
    if actual != expected {
        return Err("SDK feature payloads and exported node contracts differ".into());
    }
    Ok(manifest)
}
