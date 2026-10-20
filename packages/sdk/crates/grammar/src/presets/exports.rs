use crate::bindings::Catalog;
use serde_json::{Map, Value, json};

/// Export members are SDK API names. Display labels never resolve these members.
pub(crate) fn catalog() -> Catalog {
    let mut catalog = Catalog::default();
    let mut plugins = Map::new();
    for feature in traq_markdown_features::all() {
        let index = catalog.plugin((feature.syntax)());
        let group = plugins
            .entry(feature.export.group)
            .or_insert_with(|| json!({}));
        assert!(
            group
                .as_object_mut()
                .expect("plugin export group")
                .insert(feature.export.member.into(), json!(index))
                .is_none(),
            "duplicate SDK feature export"
        );
    }

    for preset in crate::bindings::PRESETS {
        catalog.preset(&(preset.builder)()).expect("valid preset");
    }

    catalog.exports = json!({
        "plugins": Value::Object(plugins),
        "presets": crate::bindings::preset_exports()
    });
    catalog
}
