use crate::bindings::Catalog;

/// Export members are SDK API names. Display labels never resolve these members.
pub(crate) fn catalog() -> Catalog {
    let mut catalog = Catalog::default();
    for feature in traq_markdown_features::all() {
        let index = catalog.plugin((feature.syntax)());
        assert!(
            catalog
                .exports
                .plugins
                .entry(feature.export.group.into())
                .or_default()
                .insert(feature.export.member.into(), index)
                .is_none(),
            "duplicate SDK feature export"
        );
    }
    for preset in crate::bindings::PRESETS {
        catalog.preset(&(preset.builder)()).expect("valid preset");
    }
    catalog.exports.presets = crate::bindings::preset_exports();
    catalog
}
