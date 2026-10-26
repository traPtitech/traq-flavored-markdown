//! CommonMark text rendering rules, independent of parsing and product policy.
#![doc = include_str!("../README.md")]
#![forbid(unsafe_code)]

pub mod html;
mod rules;
use markdown_ast::Node;
use markdown_commonmark_contracts::{Link, LinkForm};
use markdown_renderer::Context;
use markdown_renderer::Output;
use markdown_renderer::RenderPlugin;
use markdown_renderer::Result;
use std::sync::LazyLock;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum ExplicitLinkStyle {
    #[default]
    Label,
    LabelAndDestination,
}

impl ExplicitLinkStyle {
    pub fn render(
        self,
        link: &Link,
        nodes: &[Node],
        context: &Context<'_>,
        output: &mut Output<'_>,
    ) -> Result<()> {
        if matches!(
            (link.form, self),
            (LinkForm::Explicit, Self::LabelAndDestination)
        ) {
            output.push("[")?;
            context.children(nodes, output)?;
            output.push("](")?;
            output.push(&link.destination)?;
            output.push(")")
        } else {
            context.children(nodes, output)
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Options {
    pub explicit_links: ExplicitLinkStyle,
}

/// A shared implementation snapshot; callers may customize it with replace.
pub fn plugin() -> RenderPlugin {
    static PLUGIN: LazyLock<RenderPlugin> =
        LazyLock::new(|| build(Options::default()).expect("valid CommonMark text plugin"));
    PLUGIN.clone()
}

pub fn plugin_with_options(options: Options) -> RenderPlugin {
    build(options).expect("valid CommonMark text plugin")
}

fn build(options: Options) -> Result<RenderPlugin> {
    let mut plugin = RenderPlugin::new(&markdown_commonmark_contracts::declarations().plugin);
    rules::register(&mut plugin, options)?;
    Ok(plugin)
}
