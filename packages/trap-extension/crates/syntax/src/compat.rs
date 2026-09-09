use markdown_commonmark::{self as commonmark, LinkOptions};

use markdown_parser::{
    NodeKind, Span,
    engine::{
        Plugin,
        block::{BlockRule, DraftContent, DraftNode},
    },
};

pub use markdown_trap_contracts::BlankLineData;

pub fn links() -> LinkOptions {
    LinkOptions {
        direct_images: false,
        nested_autolinks: true,
        normalize: commonmark::inlines::url::normalize,
    }
}

pub fn blank_rule() -> &'static BlockRule {
    static RULE: std::sync::LazyLock<BlockRule> = std::sync::LazyLock::new(|| {
        BlockRule::new(|input, _| {
            if !input.current().bytes().all(|b| b == b' ' || b == b'\t') {
                return Ok(None);
            }
            let mut result = input.leaf(
                input.start + 1,
                markdown_parser::NodeKind::new(BlankLineData {}),
            )?;
            result.consume_separator = false;
            Ok(Some(result))
        })
        .named("blank")
    });
    &RULE
}

pub fn quote_rule() -> &'static BlockRule {
    static RULE: std::sync::LazyLock<BlockRule> = std::sync::LazyLock::new(|| {
        BlockRule::new(|input, budget| {
            let Some(mut found) = commonmark::blocks::quote::parse(input, budget)? else {
                return Ok(None);
            };

            for node in &mut found.nodes {
                if is_blank_quote(node) {
                    node.finish = Some(add_blank_line);
                }
            }

            Ok(Some(found))
        })
        .named("quote")
    });
    &RULE
}

fn is_blank_quote(node: &DraftNode) -> bool {
    matches!(&node.content, DraftContent::Blocks(view) if view
        .text()
        .trim_matches([' ', '\t', '\n', '\r'])
        .is_empty())
}

fn add_blank_line(node: &mut DraftNode) {
    if node.children().is_empty() {
        let span = Span {
            start: node.span.end,
            end: node.span.end,
        };

        let blank = NodeKind::new(BlankLineData {});

        node.content = DraftContent::Nodes(vec![DraftNode::leaf(span, blank)]);
    }
}

pub fn plugin() -> &'static Plugin {
    static PLUGIN: std::sync::LazyLock<Plugin> = std::sync::LazyLock::new(|| {
        let mut plugin = Plugin::new(&markdown_trap_contracts::preset().compat);
        plugin.add(blank_rule());
        plugin.add(quote_rule());
        plugin
    });
    &PLUGIN
}
