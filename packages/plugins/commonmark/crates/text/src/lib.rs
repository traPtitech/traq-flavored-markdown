//! CommonMark text rendering rules, independent of parsing and product policy.
#![doc = include_str!("../README.md")]
#![forbid(unsafe_code)]

pub mod html;
mod rules;
use markdown_ast::Node;
use markdown_commonmark_contracts::{Link, LinkForm};
use markdown_renderer::{Context, Plugin, Result};
use std::sync::LazyLock;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum ExplicitLinkStyle {
    #[default]
    Label,
    LabelAndDestination,
}

impl ExplicitLinkStyle {
    pub fn render(self, link: &Link, nodes: &[Node], context: &Context<'_>) -> Result<String> {
        let label = context.children(nodes)?;
        Ok(match (link.form, self) {
            (LinkForm::Explicit, Self::LabelAndDestination) => {
                format!("[{label}]({})", link.destination)
            }
            _ => label,
        })
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Options {
    pub explicit_links: ExplicitLinkStyle,
}

/// A shared implementation snapshot; callers may customize it with replace.
pub fn plugin() -> Plugin {
    static PLUGIN: LazyLock<Plugin> =
        LazyLock::new(|| build(Options::default()).expect("valid CommonMark text plugin"));
    PLUGIN.clone()
}

pub fn plugin_with_options(options: Options) -> Plugin {
    build(options).expect("valid CommonMark text plugin")
}

fn build(options: Options) -> Result<Plugin> {
    let mut plugin = Plugin::new(&markdown_commonmark_contracts::preset().plugin);
    rules::register(&mut plugin, options)?;
    Ok(plugin)
}
