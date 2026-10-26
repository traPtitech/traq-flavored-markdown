use markdown_commonmark::inlines::emphasis::paired_rule;
use markdown_parser::AnyPayload;
use markdown_parser::grammar::SyntaxPlugin;
use markdown_parser::rules::inline::InlineRule;
pub use markdown_traq_contracts::Spoiler;

pub fn inline_rule() -> &'static InlineRule {
    static RULE: std::sync::LazyLock<InlineRule> = std::sync::LazyLock::new(|| {
        paired_rule(b"!", "spoiler", 2, || AnyPayload::new(Spoiler {}))
    });
    &RULE
}

pub fn plugin() -> &'static SyntaxPlugin {
    static PLUGIN: std::sync::LazyLock<SyntaxPlugin> = std::sync::LazyLock::new(|| {
        SyntaxPlugin::from_rule(
            &markdown_traq_contracts::declarations().spoiler,
            inline_rule(),
        )
    });
    &PLUGIN
}
