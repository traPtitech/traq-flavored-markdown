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
        let extensions = Plugin::group("extensions");
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
