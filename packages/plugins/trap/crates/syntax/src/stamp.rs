use markdown_parser::{
    ParseError,
    engine::{
        Plugin,
        inline::{InlineMatch, InlineRule},
    },
};
pub use markdown_trap_contracts::StampData;

pub fn inline_rule() -> &'static InlineRule {
    static RULE: std::sync::LazyLock<InlineRule> =
        std::sync::LazyLock::new(|| InlineRule::new(b":", parse).named("stamp"));
    &RULE
}

fn parse(
    input: &markdown_parser::engine::inline::InlineInput<'_>,
    budget: &mut markdown_parser::engine::Budget,
) -> Result<Option<InlineMatch>, ParseError> {
    static STAMP: std::sync::LazyLock<regex::Regex> = std::sync::LazyLock::new(|| {
        regex::Regex::new(
            r#"^:(?:[a-zA-Z0-9+_-]{1,32}|@(?:Webhook#)?[a-zA-Z0-9_-]+|[a-zA-Z0-9_]+\([^:<>"'=+!?]+\))(?:\.[a-zA-Z0-9_+.-]+)?:"#,
        )
        .unwrap()
    });

    let tail = input.tail();
    let limit = tail[1..].find(':').map_or(tail.len(), |n| n + 2);

    budget.spend(limit)?;
    let Some(matched) = STAMP.find(&tail[..limit]) else {
        return Ok(None);
    };

    let data = StampData {
        literal: tail[..matched.end()].into(),
    };

    Ok(Some(InlineMatch::leaf(
        input.position + matched.end(),
        markdown_parser::NodeKind::new(data),
    )))
}

pub fn plugin() -> &'static Plugin {
    static PLUGIN: std::sync::LazyLock<Plugin> = std::sync::LazyLock::new(|| {
        let mut plugin = Plugin::new(&markdown_trap_contracts::preset().stamp);
        plugin.add(inline_rule());
        plugin
    });
    &PLUGIN
}
