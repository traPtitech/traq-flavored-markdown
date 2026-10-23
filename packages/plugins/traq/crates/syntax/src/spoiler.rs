use markdown_commonmark::inlines::emphasis::paired_rule;
use markdown_parser::{
    NodeKind,
    engine::{Plugin, inline::InlineRule},
};
pub use markdown_trap_contracts::Spoiler;

pub fn inline_rule() -> &'static InlineRule {
    static RULE: std::sync::LazyLock<InlineRule> =
        std::sync::LazyLock::new(|| paired_rule(b"!", "spoiler", 2, || NodeKind::new(Spoiler {})));
    &RULE
}

pub fn plugin() -> &'static Plugin {
    static PLUGIN: std::sync::LazyLock<Plugin> = std::sync::LazyLock::new(|| {
        Plugin::from_rule(
            &markdown_trap_contracts::declarations().spoiler,
            inline_rule(),
        )
    });
    &PLUGIN
}
