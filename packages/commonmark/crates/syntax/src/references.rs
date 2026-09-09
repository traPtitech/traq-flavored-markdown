use super::inlines::destination::destination;
use markdown_parser::{ParseError, engine::Budget};

pub(crate) fn key(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
        .to_uppercase()
}

pub(crate) fn label_end(source: &str) -> Option<usize> {
    if !source.starts_with('[') {
        return None;
    }

    let mut escaped = false;

    for (index, ch) in source[1..].char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        match ch {
            '\\' => escaped = true,
            '[' => return None,
            ']' => return Some(index + 1),
            _ => {}
        }
    }

    None
}

pub(crate) fn definition(
    source: &str,
    budget: &mut Budget,
    normalize: fn(&str) -> Option<String>,
) -> Result<Option<(String, String, Option<String>)>, ParseError> {
    let source = normalize_definition(source);
    let source = source.trim_matches([' ', '\t', '\n']);

    let Some(end) = label_end(source) else {
        return Ok(None);
    };

    if source.as_bytes().get(end + 1) != Some(&b':') {
        return Ok(None);
    }

    let key = key(&source[1..end]);
    if key.is_empty() {
        return Ok(None);
    }

    let tail = source[end + 2..].trim_matches([' ', '\t', '\n']);
    if tail.is_empty() {
        return Ok(None);
    }

    let wrapped = format!("({tail})");
    let Some((end, target, title)) = destination(&wrapped, 0, budget, normalize)? else {
        return Ok(None);
    };

    Ok((end == wrapped.len()).then_some((key, target, title)))
}

fn normalize_definition(source: &str) -> String {
    source
        .lines()
        .map(|line| line.trim_start_matches([' ', '\t']))
        .collect::<Vec<_>>()
        .join("\n")
}
