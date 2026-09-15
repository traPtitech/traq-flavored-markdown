use markdown_generic_contracts::*;
use markdown_renderer::{Plugin, Result};

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

pub fn plugin() -> Plugin {
    static PLUGIN: LazyLock<Plugin> =
        LazyLock::new(|| build(Options::default()).expect("valid math text plugin"));
    PLUGIN.clone()
}

pub fn plugin_with_options(options: Options) -> Plugin {
    build(options).expect("valid math text plugin")
}

fn build(options: Options) -> Result<Plugin> {
    let mut math = Plugin::new(&markdown_generic_contracts::preset().math);
    math.on::<InlineMathData>(move |v, _, _| {
        Ok(match options.style {
            Style::Tex => v.tex.clone(),
            Style::DelimitedTex => format!("${}$", v.tex),
        })
    })?;

    math.on::<BlockMathData>(move |v, _, ctx| {
        let mut output = match options.style {
            Style::Tex => v.tex.clone(),
            Style::DelimitedTex => format!("$${}$$", v.tex),
        };
        ctx.append(&mut output, "\n")?;
        Ok(output)
    })?;
    Ok(math)
}
