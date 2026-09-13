use markdown_definitions::Plugin;
use std::sync::LazyLock;

/// Shared declarations, not an executable syntax or rendering preset.
pub struct Contracts {
    pub math: Plugin,
    pub table: Plugin,
    pub mark: Plugin,
    pub strikethrough: Plugin,
    pub linkify: Plugin,
}

pub fn preset() -> &'static Contracts {
    static CONTRACTS: LazyLock<Contracts> = LazyLock::new(|| {
        let generic = Plugin::group("generic");
        Contracts {
            math: generic.new("math"),
            table: generic.new("table"),
            mark: generic.new("mark"),
            strikethrough: generic.new("strikethrough"),
            linkify: generic.new("linkify"),
        }
    });
    &CONTRACTS
}
