use markdown_definitions::Plugin;
use std::sync::LazyLock;

/// Shared declarations, not an executable syntax or rendering preset.
pub struct PluginDeclarations {
    pub math: Plugin,
    pub table: Plugin,
    pub mark: Plugin,
    pub strikethrough: Plugin,
    pub linkify: Plugin,
}

pub fn declarations() -> &'static PluginDeclarations {
    static CONTRACTS: LazyLock<PluginDeclarations> = LazyLock::new(|| {
        let generic = Plugin::group("generic");
        PluginDeclarations {
            math: generic.plugin("math"),
            table: generic.plugin("table"),
            mark: generic.plugin("mark"),
            strikethrough: generic.plugin("strikethrough"),
            linkify: generic.plugin("linkify"),
        }
    });
    &CONTRACTS
}
