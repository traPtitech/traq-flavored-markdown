#![forbid(unsafe_code)]

pub mod blocks;
mod context;
pub mod html;
pub mod inlines;
pub(crate) mod references;

use markdown_parser::grammar::SyntaxPlugin;

/// CommonMark rules expose typed anchors for extension composition.
pub struct Syntax {
    pub plugin: SyntaxPlugin,
    pub inline: inlines::Rules,
    pub block: blocks::Rules,
}

impl Syntax {
    pub fn new() -> Self {
        let inline = inlines::rules();
        let block = blocks::rules();

        let mut plugin = SyntaxPlugin::new(&markdown_commonmark_contracts::declarations().plugin);
        plugin.block_policy(blocks::CommonmarkBlocks);
        plugin.text(|value| markdown_commonmark_contracts::Text { value });

        inline.register(&mut plugin);
        block.register(&mut plugin);

        Self {
            plugin,
            inline,
            block,
        }
    }
}

impl Default for Syntax {
    fn default() -> Self {
        Self::new()
    }
}
