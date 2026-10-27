mod block;
mod tags;

use markdown_parser::AnyPayload;
use markdown_parser::grammar::SyntaxPlugin;
use markdown_parser::rules::block::BlockRule;
use markdown_parser::rules::inline::InlineMatch;
use markdown_parser::rules::inline::InlineRule;

pub fn block_rule() -> &'static BlockRule {
    static RULE: std::sync::LazyLock<BlockRule> = std::sync::LazyLock::new(|| {
        BlockRule::new(block::parse)
            .named("html")
            .interrupts(|probe| {
                block::start(probe.line).is_some_and(block::HtmlBlockKind::interrupts)
            })
    });
    &RULE
}

pub fn inline_rule() -> &'static InlineRule {
    static RULE: std::sync::LazyLock<InlineRule> = std::sync::LazyLock::new(|| {
        InlineRule::new(b"<", |input, budget| {
            budget.spend(input.tail().len())?;

            let Some(end) = tags::inline_end(input.tail()) else {
                return Ok(None);
            };

            Ok(Some(InlineMatch::leaf(
                input.position + end,
                AnyPayload::new(markdown_commonmark_contracts::HtmlInline {
                    literal: input.tail()[..end].into(),
                }),
            )))
        })
        .named("html")
    });
    &RULE
}

pub fn plugin() -> &'static SyntaxPlugin {
    static PLUGIN: std::sync::LazyLock<SyntaxPlugin> = std::sync::LazyLock::new(|| {
        let mut plugin = SyntaxPlugin::new(&markdown_commonmark_contracts::declarations().html);
        plugin.add(block_rule());
        plugin.add(inline_rule());
        plugin
    });
    &PLUGIN
}
