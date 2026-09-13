use markdown_definitions::Plugin;
use std::sync::LazyLock;

/// Shared declarations, not an executable syntax or rendering preset.
pub struct Contracts {
    pub references: Plugin,
    pub stamp: Plugin,
    pub spoiler: Plugin,
    pub compat: Plugin,
}

pub fn preset() -> &'static Contracts {
    static CONTRACTS: LazyLock<Contracts> = LazyLock::new(|| {
        let trap = Plugin::group("trap");
        Contracts {
            references: trap.new("references"),
            stamp: trap.new("stamp"),
            spoiler: trap.new("spoiler"),
            compat: trap.new("compat"),
        }
    });
    &CONTRACTS
}
