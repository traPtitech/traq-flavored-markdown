mod cells;
mod parse;

pub use markdown_generic_contracts::{Alignment, CellData, RowData, TableData};

use markdown_parser::engine::{
    Plugin,
    block::{BlockRule, Interrupt},
};

pub fn block_rule() -> &'static BlockRule {
    static RULE: std::sync::LazyLock<BlockRule> = std::sync::LazyLock::new(|| {
        BlockRule::new(parse::parse)
            .named("table")
            .interrupts(|probe| {
                probe.context == Interrupt::Paragraph
                    && probe
                        .next
                        .is_some_and(|next| cells::alignment(probe.line, next).is_some())
            })
    });
    &RULE
}

pub fn plugin() -> &'static Plugin {
    static PLUGIN: std::sync::LazyLock<Plugin> = std::sync::LazyLock::new(|| {
        let mut plugin = Plugin::new(&markdown_generic_contracts::preset().table);
        plugin.add(block_rule());
        plugin
    });
    &PLUGIN
}
