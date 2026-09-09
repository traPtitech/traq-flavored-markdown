use markdown_generic_contracts::*;
use markdown_renderer::{Plugin, Result};

use std::sync::LazyLock;

pub fn plugin() -> Plugin {
    static PLUGIN: LazyLock<Plugin> = LazyLock::new(|| build().expect("valid math text plugin"));
    PLUGIN.clone()
}

fn build() -> Result<Plugin> {
    let mut math = Plugin::new(&markdown_generic_contracts::preset().math);
    math.on::<InlineMathData>(|v, _, _| Ok(v.tex.clone()))?;

    math.on::<BlockMathData>(|v, _, ctx| {
        let mut output = v.tex.clone();
        ctx.append(&mut output, "\n")?;
        Ok(output)
    })?;
    Ok(math)
}
