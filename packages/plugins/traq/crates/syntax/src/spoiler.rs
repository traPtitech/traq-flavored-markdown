use markdown_commonmark::inlines::emphasis::paired;
use markdown_parser::{
    NodeKind,
    engine::{Plugin, inline::InlineRule},
};
pub use markdown_trap_contracts::SpoilerData;

/// frontPrior consumes pairs and leaves an odd '!' for JSON or image syntax.
pub fn inline_rule() -> &'static InlineRule {
    static RULE: std::sync::LazyLock<InlineRule> = std::sync::LazyLock::new(|| {
        InlineRule::new(b"!", |input, budget| {
            paired(input, budget, 2, false, false, |_| {
                NodeKind::new(SpoilerData {})
            })
        })
        .named("spoiler")
    });
    &RULE
}

pub fn plugin() -> &'static Plugin {
    static PLUGIN: std::sync::LazyLock<Plugin> = std::sync::LazyLock::new(|| {
        let mut plugin = Plugin::new(&markdown_trap_contracts::preset().spoiler);
        plugin.add(inline_rule());
        plugin
    });
    &PLUGIN
}
