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
        let trap = PluginDeclaration::group("traq");
        PluginDeclarations {
            references: trap.plugin("references"),
            stamp: trap.plugin("stamp"),
            spoiler: trap.plugin("spoiler"),
            spacing: trap.plugin("spacing"),
        }
    });
    &CONTRACTS
}
