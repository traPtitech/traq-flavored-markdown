use markdown_definitions::PluginDeclaration;
use std::sync::LazyLock;

/// Shared declarations, not an executable syntax or rendering preset.
pub struct PluginDeclarations {
    pub math: PluginDeclaration,
    pub table: PluginDeclaration,
    pub mark: PluginDeclaration,
    pub strikethrough: PluginDeclaration,
    pub linkify: PluginDeclaration,
}

pub fn declarations() -> &'static PluginDeclarations {
    static CONTRACTS: LazyLock<PluginDeclarations> = LazyLock::new(|| {
        let extensions = PluginDeclaration::group("extensions");
        PluginDeclarations {
            math: extensions.plugin("math"),
            table: extensions.plugin("table"),
            mark: extensions.plugin("mark"),
            strikethrough: extensions.plugin("strikethrough"),
            linkify: extensions.plugin("linkify"),
        }
    });
    &CONTRACTS
}
