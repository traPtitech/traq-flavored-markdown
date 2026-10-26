use markdown_commonmark::inlines::emphasis::paired_rule;
pub use markdown_extensions_contracts::Mark;
use markdown_parser::AnyPayload;
use markdown_parser::grammar::SyntaxPlugin;
use markdown_parser::rules::inline::InlineRule;

pub fn inline_rule() -> &'static InlineRule {
    static RULE: std::sync::LazyLock<InlineRule> =
        std::sync::LazyLock::new(|| paired_rule(b"=", "mark", 2, || AnyPayload::new(Mark {})));
    &RULE
}

pub fn plugin() -> &'static SyntaxPlugin {
    static PLUGIN: std::sync::LazyLock<SyntaxPlugin> = std::sync::LazyLock::new(|| {
        SyntaxPlugin::from_rule(
            &markdown_extensions_contracts::declarations().mark,
            inline_rule(),
        )
    });
    &PLUGIN
}
