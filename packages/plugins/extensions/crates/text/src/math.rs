use markdown_extensions_contracts::*;
use markdown_renderer::RenderPlugin;
use markdown_renderer::Result;

use std::sync::LazyLock;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum Style {
    #[default]
    Tex,
    DelimitedTex,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Options {
    pub style: Style,
}

pub fn plugin() -> RenderPlugin {
    static PLUGIN: LazyLock<RenderPlugin> =
        LazyLock::new(|| build(Options::default()).expect("valid math text plugin"));
    PLUGIN.clone()
}

pub fn plugin_with_options(options: Options) -> RenderPlugin {
    build(options).expect("valid math text plugin")
}

fn build(options: Options) -> Result<RenderPlugin> {
    let mut math = RenderPlugin::new(&markdown_extensions_contracts::declarations().math);
    math.on::<InlineMath>(move |v, _, _, output| {
        if options.style == Style::DelimitedTex {
            output.push("$")?;
        }
        output.push(&v.tex)?;
        if options.style == Style::DelimitedTex {
            output.push("$")?;
        }
        Ok(())
    })?;

    math.on::<BlockMath>(move |v, _, _, output| {
        if options.style == Style::DelimitedTex {
            output.push("$$")?;
        }
        output.push(&v.tex)?;
        if options.style == Style::DelimitedTex {
            output.push("$$")?;
        }
        output.push("\n")
    })?;
    Ok(math)
}
