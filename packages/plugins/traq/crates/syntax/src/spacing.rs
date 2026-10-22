//! Preserve source blank lines left after a block's paragraph separator.
use markdown_parser::engine::{Plugin, block::BlockRule};

pub use markdown_trap_contracts::BlankLine;

pub fn blank_rule() -> &'static BlockRule {
    static RULE: std::sync::LazyLock<BlockRule> = std::sync::LazyLock::new(|| {
        BlockRule::new(|input, _| {
            if !input.current().bytes().all(|b| b == b' ' || b == b'\t') {
                return Ok(None);
            }
            let mut result = input.leaf(input.start + 1, BlankLine {}.into())?;
            result.following = markdown_parser::engine::block::Following::Preserve;
            Ok(Some(result))
        })
        .named("blank")
    });
    &RULE
}

pub fn plugin() -> &'static Plugin {
    static PLUGIN: std::sync::LazyLock<Plugin> = std::sync::LazyLock::new(|| {
        let mut plugin = Plugin::new(&markdown_trap_contracts::declarations().spacing);
        plugin.add(blank_rule());
        plugin
    });
    &PLUGIN
}
