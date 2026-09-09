mod block;
mod inline;

pub use markdown_generic_contracts::{BlockMathData, InlineMathData};
use markdown_parser::engine::{Plugin, block::BlockRule, inline::InlineRule};

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
            .interrupts(|probe| probe.line.starts_with("$$"))
    });
    &RULE
}

pub fn plugin() -> &'static Plugin {
    static PLUGIN: std::sync::LazyLock<Plugin> = std::sync::LazyLock::new(|| {
        let mut plugin = Plugin::new(&markdown_generic_contracts::preset().math);
        plugin.add(inline_rule());
        plugin.add(block_rule());
        plugin
    });
    &PLUGIN
}
