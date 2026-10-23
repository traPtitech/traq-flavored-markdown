use markdown_parser::ParseError;
use markdown_parser::grammar::SyntaxPlugin;
use markdown_parser::rules::Budget;
use markdown_parser::rules::inline::InlineInput;
use markdown_parser::rules::inline::InlineMatch;
use markdown_parser::rules::inline::InlineRule;
use markdown_parser::source::ViewOffset;

pub use markdown_traq_contracts::{Embedding, EmbeddingKind, Reference, ReferenceKind};

pub fn inline_rule() -> &'static InlineRule {
    static RULE: std::sync::LazyLock<InlineRule> =
        std::sync::LazyLock::new(|| InlineRule::new(b"!", parse).named("json_reference"));
    &RULE
}

pub fn plugin() -> &'static SyntaxPlugin {
    static PLUGIN: std::sync::LazyLock<SyntaxPlugin> = std::sync::LazyLock::new(|| {
        let mut plugin = SyntaxPlugin::new(&markdown_traq_contracts::declarations().references);
        plugin.add(inline_rule());
        plugin
    });
    &PLUGIN
}

fn parse(input: &InlineInput<'_>, budget: &mut Budget) -> Result<Option<InlineMatch>, ParseError> {
    if !input.tail().starts_with("!{") {
        return Ok(None);
    }

    let Some(end) = json_end(input, budget)? else {
        return Ok(None);
    };
    budget.spend(end - input.position)?;

    let text = &input.source[input.position + 1..end];

    let Some(data) = reference_data(text) else {
        return Ok(None);
    };

    Ok(Some(InlineMatch::leaf(end, data)))
}

fn json_end(
    input: &InlineInput<'_>,
    budget: &mut Budget,
) -> Result<Option<ViewOffset>, ParseError> {
    let bytes = input.source.text().as_bytes();

    let mut stack = vec![];
    let mut quote = false;
    let mut escaped = false;

    for (index, &byte) in bytes.iter().enumerate().skip((input.position + 1).get()) {
        budget.spend(1)?;

        if quote {
            if escaped {
                escaped = false;
            } else if byte == b'\\' {
                escaped = true;
            } else if byte == b'"' {
                quote = false;
            }
            continue;
        }

        match byte {
            b'"' => quote = true,
            b'{' | b'[' => {
                stack.push(byte);
                budget.nesting(stack.len())?;
            }
            b'}' | b']' => {
                if stack.pop() != Some(if byte == b'}' { b'{' } else { b'[' }) {
                    return Ok(None);
                }
                if stack.is_empty() {
                    return Ok(Some(input.source.offset(index + 1)?));
                }
            }
            _ => {}
        }
    }

    Ok(None)
}

fn reference_data(text: &str) -> Option<markdown_parser::AnyPayload> {
    let value = serde_json::from_str::<serde_json::Value>(text).ok()?;
    let target = value.get("type").and_then(|value| value.as_str())?;
    let id = value.get("id").and_then(|value| value.as_str())?;

    if let Some(kind) = embedding_kind(target) {
        return Some(markdown_parser::AnyPayload::new(Embedding {
            target: kind,
            id: id.into(),
            label: value
                .get("raw")
                .and_then(|value| value.as_str())
                .unwrap_or("")
                .into(),
            literal: format!("!{text}"),
        }));
    }

    let label = value.get("raw").and_then(|value| value.as_str())?;
    let target = reference_kind(target)?;

    Some(markdown_parser::AnyPayload::new(Reference {
        target,
        id: id.into(),
        label: label.into(),
    }))
}

fn embedding_kind(target: &str) -> Option<EmbeddingKind> {
    match target {
        "file" => Some(EmbeddingKind::File),
        "message" => Some(EmbeddingKind::Message),
        _ => None,
    }
}

fn reference_kind(target: &str) -> Option<ReferenceKind> {
    match target {
        "user" => Some(ReferenceKind::User),
        "group" => Some(ReferenceKind::Group),
        "channel" => Some(ReferenceKind::Channel),
        _ => None,
    }
}
