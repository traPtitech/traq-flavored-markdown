use markdown_definitions::Plugin;
use std::sync::LazyLock;

/// Shared plugin declarations. Node types supply their own generated metadata.
pub struct PluginDeclarations {
    pub plugin: Plugin,
    pub html: Plugin,
}

pub fn declarations() -> &'static PluginDeclarations {
    static PRESET: LazyLock<PluginDeclarations> = LazyLock::new(|| {
        let commonmark = Plugin::group("CommonMark");
        PluginDeclarations {
            plugin: commonmark.plugin("Core"),
            html: commonmark.plugin("Html"),
        }
    });
    &PRESET
}
