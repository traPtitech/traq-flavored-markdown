mod block;
mod tags;

use markdown_parser::{
    NodeKind,
    engine::{
        Plugin,
        block::BlockRule,
        inline::{InlineMatch, InlineRule},
    },
};

pub fn block_rule() -> &'static BlockRule {
    static RULE: std::sync::LazyLock<BlockRule> = std::sync::LazyLock::new(|| {
        BlockRule::new(block::parse)
            .named("html")
            .interrupts(|probe| block::start(probe.line).is_some_and(|kind| kind != 7))
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
                NodeKind::new(markdown_commonmark_contracts::HtmlInline {
                    literal: input.tail()[..end].into(),
                }),
            )))
        })
        .named("html")
    });
    &RULE
}

pub fn plugin() -> &'static Plugin {
    static PLUGIN: std::sync::LazyLock<Plugin> = std::sync::LazyLock::new(|| {
        let mut plugin = Plugin::new(&markdown_commonmark_contracts::preset().html);
        plugin.add(block_rule());
        plugin.add(inline_rule());
        plugin
    });
    &PLUGIN
}
