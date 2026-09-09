//! CommonMark text rendering rules, independent of parsing and product policy.
#![doc = include_str!("../README.md")]
#![forbid(unsafe_code)]

pub mod html;
mod rules;
use markdown_renderer::Plugin;
use std::sync::LazyLock;

/// A shared implementation snapshot; callers may customize it with replace.
pub fn plugin() -> Plugin {
    static PLUGIN: LazyLock<Plugin> = LazyLock::new(|| {
        let mut plugin = Plugin::new(&markdown_commonmark_contracts::preset().plugin);
        rules::register(&mut plugin).expect("valid CommonMark text plugin");
        plugin
    });
    PLUGIN.clone()
}
