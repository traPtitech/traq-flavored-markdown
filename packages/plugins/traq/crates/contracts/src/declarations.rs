use markdown_definitions::PluginDeclaration;
use std::sync::LazyLock;

/// Shared declarations, not an executable syntax or rendering preset.
pub struct PluginDeclarations {
    pub references: PluginDeclaration,
    pub stamp: PluginDeclaration,
    pub spoiler: PluginDeclaration,
    pub spacing: PluginDeclaration,
}

pub fn declarations() -> &'static PluginDeclarations {
    static CONTRACTS: LazyLock<PluginDeclarations> = LazyLock::new(|| {
        let traq = PluginDeclaration::group("traq");
        PluginDeclarations {
            references: traq.plugin("references"),
            stamp: traq.plugin("stamp"),
            spoiler: traq.plugin("spoiler"),
            spacing: traq.plugin("spacing"),
        }
    });
    &CONTRACTS
}
