//! Catalog composition belongs to this distribution, not the parser core.
pub use markdown_parser::bindings::*;

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
            fn collect(
                catalog: &Catalog,
                value: &serde_json::Value,
                name: &str,
                grammars: &mut std::collections::BTreeMap<String, crate::Grammar>,
            ) {
                if let Some(index) = value.as_u64() {
                    let composition = catalog
                        .preset_composition(index as usize)
                        .expect("exported grammar must have a composition");
                    let grammar = catalog.build(&composition).expect("valid exported grammar");
                    grammars.insert(name.to_owned(), grammar);
                } else if let Some(members) = value.as_object() {
                    for (member, value) in members {
                        let name = if name.is_empty() {
                            member.clone()
                        } else {
                            format!("{name}.{member}")
                        };
                        collect(catalog, value, &name, grammars);
                    }
                }
            }

            let catalog = bundled();
            let mut grammars = std::collections::BTreeMap::new();
            collect(catalog, &catalog.exports["presets"], "", &mut grammars);
            grammars
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
