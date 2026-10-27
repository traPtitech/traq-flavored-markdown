mod block;
mod inline;

pub use markdown_extensions_contracts::{BlockMath, InlineMath};
use markdown_parser::grammar::SyntaxPlugin;
use markdown_parser::rules::block::BlockRule;
use markdown_parser::rules::inline::InlineRule;

/// The legacy dollar grammar has its own fixed implementation and contract.
pub fn inline_rule() -> &'static InlineRule {
    static RULE: std::sync::LazyLock<InlineRule> =
        std::sync::LazyLock::new(|| InlineRule::new(b"$", inline::parse).named("math"));
    &RULE
}

pub fn block_rule() -> &'static BlockRule {
    static RULE: std::sync::LazyLock<BlockRule> = std::sync::LazyLock::new(|| {
        BlockRule::new(block::parse)
            .named("math")
            .interrupts(|probe| block::opening(probe.line).is_some())
    });
    &RULE
}

pub fn plugin() -> &'static SyntaxPlugin {
    static PLUGIN: std::sync::LazyLock<SyntaxPlugin> = std::sync::LazyLock::new(|| {
        let mut plugin = SyntaxPlugin::new(&markdown_extensions_contracts::declarations().math);
        plugin.add(inline_rule());
        plugin.add(block_rule());
        plugin
    });
    &PLUGIN
}
