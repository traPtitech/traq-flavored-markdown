#![forbid(unsafe_code)]
#![allow(clippy::single_range_in_vec_init)]

pub mod blocks;
mod context;
pub mod html;
pub mod inlines;
pub(crate) mod references;

pub use inlines::links::LinkOptions;
use markdown_parser::engine::Plugin;

/// Configured CommonMark rules expose typed anchors for extension composition.
pub struct Syntax {
    pub plugin: Plugin,
    pub inline: inlines::Rules,
    pub block: blocks::Rules,
}

impl Syntax {
    pub fn new(options: LinkOptions) -> Self {
        let inline = inlines::rules(options);
        let block = blocks::rules(options);

        let mut plugin = Plugin::new(&markdown_commonmark_contracts::preset().plugin);
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
        Self::new(LinkOptions::default())
    }
}
