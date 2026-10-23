use markdown_definitions::Plugin;
use std::sync::LazyLock;

/// Shared declarations, not an executable syntax or rendering preset.
pub struct PluginDeclarations {
    pub references: Plugin,
    pub stamp: Plugin,
    pub spoiler: Plugin,
    pub spacing: Plugin,
}

pub fn declarations() -> &'static PluginDeclarations {
    static CONTRACTS: LazyLock<PluginDeclarations> = LazyLock::new(|| {
        let trap = Plugin::group("traq");
        PluginDeclarations {
            references: trap.plugin("references"),
            stamp: trap.plugin("stamp"),
            spoiler: trap.plugin("spoiler"),
            spacing: trap.plugin("spacing"),
        }
    });
    &CONTRACTS
}
