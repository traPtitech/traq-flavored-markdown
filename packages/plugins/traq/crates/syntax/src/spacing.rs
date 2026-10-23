//! Preserve source blank lines left after a block's paragraph separator.
use markdown_parser::grammar::SyntaxPlugin;
use markdown_parser::rules::block::BlockRule;

pub use markdown_traq_contracts::BlankLine;

pub fn blank_rule() -> &'static BlockRule {
    static RULE: std::sync::LazyLock<BlockRule> = std::sync::LazyLock::new(|| {
        BlockRule::new(|input, _| {
            if !input.current().bytes().all(|b| b == b' ' || b == b'\t') {
                return Ok(None);
            }
            let mut result = input.leaf(input.start + 1, BlankLine {}.into())?;
            result.following = markdown_parser::rules::block::Following::Preserve;
            Ok(Some(result))
        })
        .named("blank")
    });
    &RULE
}

pub fn plugin() -> &'static SyntaxPlugin {
    static PLUGIN: std::sync::LazyLock<SyntaxPlugin> = std::sync::LazyLock::new(|| {
        let mut plugin = SyntaxPlugin::new(&markdown_traq_contracts::declarations().spacing);
        plugin.add(blank_rule());
        plugin
    });
    &PLUGIN
}
