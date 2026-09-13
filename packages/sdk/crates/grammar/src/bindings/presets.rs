use crate::{Grammar, GrammarBuilder, presets};

/// One list owns both SDK names and native implementations. Builders are used
/// only by the editable Catalog API; normal configuration uses the cached grammar.
pub(crate) struct Preset {
    path: &'static [&'static str],
    pub grammar: fn() -> &'static Grammar,
    pub builder: fn() -> GrammarBuilder,
}

pub(crate) const PRESETS: &[Preset] = &[
    Preset {
        path: &["commonmark"],
        grammar: presets::commonmark::grammar,
        builder: presets::commonmark::builder,
    },
    Preset {
        path: &["traq", "v1"],
        grammar: presets::traq::v1::grammar,
        builder: presets::traq::v1::builder,
    },
];

impl Preset {
    pub fn name(&self) -> String {
        self.path.join(".")
    }
}

/// SDK export paths without constructing a Catalog or compiling any grammar.
/// Numeric leaves retain the existing metadata format, not runtime lookup IDs.
pub fn preset_exports() -> serde_json::Value {
    let mut exports = serde_json::json!({});
    for (index, preset) in PRESETS.iter().enumerate() {
        let mut member = &mut exports;
        for part in preset.path {
            member = member
                .as_object_mut()
                .expect("preset namespace")
                .entry(*part)
                .or_insert_with(|| serde_json::json!({}));
        }
        *member = index.into();
    }
    exports
}
