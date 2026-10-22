use markdown_commonmark::inlines::emphasis::paired_rule;
pub use markdown_generic_contracts::Strikethrough;
use markdown_parser::{
    NodeKind,
    engine::{Plugin, inline::InlineRule},
};

pub fn inline_rule() -> &'static InlineRule {
    static RULE: std::sync::LazyLock<InlineRule> = std::sync::LazyLock::new(|| {
        paired_rule(b"~", "strikethrough", 2, || NodeKind::new(Strikethrough {}))
    });
    &RULE
}

pub fn plugin() -> &'static Plugin {
    static PLUGIN: std::sync::LazyLock<Plugin> = std::sync::LazyLock::new(|| {
        Plugin::from_rule(
            &markdown_generic_contracts::declarations().strikethrough,
            inline_rule(),
        )
    });
    &PLUGIN
}
