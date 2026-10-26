use markdown_definitions::PluginDeclaration;
use std::sync::LazyLock;

/// Shared plugin declarations. Node types supply their own generated metadata.
pub struct PluginDeclarations {
    pub plugin: PluginDeclaration,
    pub html: PluginDeclaration,
}

pub fn declarations() -> &'static PluginDeclarations {
    static PRESET: LazyLock<PluginDeclarations> = LazyLock::new(|| {
        let commonmark = PluginDeclaration::group("CommonMark");
        PluginDeclarations {
            plugin: commonmark.plugin("Core"),
            html: commonmark.plugin("Html"),
        }
    });
    &PRESET
}
