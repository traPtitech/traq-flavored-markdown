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
pub fn preset_exports() -> super::ExportTree<super::PresetId> {
    let mut exports = super::ExportTree::new();
    for (index, preset) in PRESETS.iter().enumerate() {
        let (leaf, path) = preset.path.split_last().expect("preset export path");
        let mut group = &mut exports;
        for part in path {
            let entry = group
                .entry((*part).into())
                .or_insert_with(|| super::ExportEntry::Group(super::ExportTree::new()));
            let super::ExportEntry::Group(nested) = entry else {
                panic!("conflicting preset export path")
            };
            group = nested;
        }
        assert!(
            group
                .insert(
                    (*leaf).into(),
                    super::ExportEntry::Id(super::PresetId(index))
                )
                .is_none(),
            "duplicate preset export"
        );
    }
    exports
}
