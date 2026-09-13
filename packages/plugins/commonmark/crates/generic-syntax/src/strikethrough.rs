use markdown_commonmark::inlines::emphasis::paired;

pub use markdown_generic_contracts::StrikethroughData;

use markdown_parser::{
    NodeKind,
    engine::{Plugin, inline::InlineRule},
};

pub fn inline_rule() -> &'static InlineRule {
    static RULE: std::sync::LazyLock<InlineRule> = std::sync::LazyLock::new(|| {
        InlineRule::new(b"~", |input, budget| {
            paired(input, budget, 2, false, false, |_| {
                NodeKind::new(StrikethroughData {})
            })
        })
        .named("strikethrough")
    });
    &RULE
}

pub fn plugin() -> &'static Plugin {
    static PLUGIN: std::sync::LazyLock<Plugin> = std::sync::LazyLock::new(|| {
        let mut plugin = Plugin::new(&markdown_generic_contracts::preset().strikethrough);
        plugin.add(inline_rule());
        plugin
    });
    &PLUGIN
}
