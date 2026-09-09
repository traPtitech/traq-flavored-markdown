use markdown_definitions::Plugin;
use std::sync::LazyLock;

/// Shared plugin declarations. Node types supply their own generated metadata.
pub struct Contracts {
    pub plugin: Plugin,
    pub html: Plugin,
}

pub fn preset() -> &'static Contracts {
    static PRESET: LazyLock<Contracts> = LazyLock::new(|| {
        let commonmark = Plugin::group("CommonMark");
        Contracts {
            plugin: commonmark.new("Core"),
            html: commonmark.new("Html"),
        }
    });
    &PRESET
}
