//! Named native grammars and SDK metadata owned by this distribution.
pub use markdown_parser::bindings::*;

mod presets;
pub(crate) use presets::PRESETS;
pub use presets::preset_exports;

use std::sync::LazyLock;

pub fn bundled() -> &'static Catalog {
    static CATALOG: LazyLock<Catalog> = LazyLock::new(crate::presets::exports::catalog);
    &CATALOG
}

/// Stable grammar identifiers and their compiled implementations.
/// Package releases may add identifiers, but must preserve existing grammars.
pub fn grammars() -> &'static std::collections::BTreeMap<String, crate::Grammar> {
    static GRAMMARS: LazyLock<std::collections::BTreeMap<String, crate::Grammar>> =
        LazyLock::new(|| {
            PRESETS
                .iter()
                .map(|preset| (preset.name(), (preset.grammar)().clone()))
                .collect()
        });
    &GRAMMARS
}

/// Resolve the exact stored identifier; unknown versions never use a fallback.
pub fn grammar(version: &str) -> Result<crate::Grammar, crate::engine::BuildError> {
    grammars()
        .get(version)
        .cloned()
        .ok_or_else(|| crate::engine::BuildError::InvalidDefinition {
            reason: format!("unknown grammar version: {version}"),
        })
}

pub fn parser(version: &str) -> Result<crate::Parser, crate::engine::BuildError> {
    grammar(version).map(|grammar| crate::Parser::new(&grammar))
}
