use markdown_commonmark::blocks::Interrupt;
mod cells;
mod parse;

pub use markdown_extensions_contracts::{Alignment, Cell, HeaderRow, Row, Table};

use markdown_parser::engine::{Plugin, block::BlockRule};

pub fn block_rule() -> &'static BlockRule {
    static RULE: std::sync::LazyLock<BlockRule> = std::sync::LazyLock::new(|| {
        BlockRule::new(parse::parse)
            .named("table")
            .interrupts(|probe| {
                probe.context::<Interrupt>() == Some(&Interrupt::Paragraph)
                    && probe
                        .next
                        .is_some_and(|next| cells::alignment(probe.line, next).is_some())
            })
    });
    &RULE
}

pub fn plugin() -> &'static Plugin {
    static PLUGIN: std::sync::LazyLock<Plugin> = std::sync::LazyLock::new(|| {
        let mut plugin = Plugin::new(&markdown_extensions_contracts::declarations().table);
        plugin.add(block_rule());
        plugin
    });
    &PLUGIN
}
