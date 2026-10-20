use super::inlines::destination::{parse_title, skip_spaces, target};
use markdown_parser::{ParseError, engine::Budget};
use std::collections::HashMap;

#[derive(Default)]
pub(crate) struct ReferenceMap(pub(crate) HashMap<String, (String, Option<String>)>);

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

pub(crate) struct ParsedDefinition {
    pub end: usize,
    pub key: String,
    pub target: String,
    pub title: Option<String>,
}

pub(crate) fn definition(
    source: &str,
    budget: &mut Budget,
) -> Result<Option<ParsedDefinition>, ParseError> {
    let trimmed = source.trim_start_matches([' ', '\t']);
    let leading = source.len() - trimmed.len();
    let source = trimmed;

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

    let bytes = source.as_bytes();
    let mut position = end + 2;
    skip_spaces(source, &mut position, budget)?;
    if position == source.len() {
        return Ok(None);
    }
    let Some(parsed) = target(source, position, budget)? else {
        return Ok(None);
    };
    position = parsed.end.get();
    let destination_end = position;
    let plain_end = line_end(source, destination_end);
    skip_spaces(source, &mut position, budget)?;
    if position > destination_end
        && bytes
            .get(position)
            .is_some_and(|b| matches!(b, b'"' | b'\'' | b'('))
    {
        let mut title_end = position;
        if let Some(title) = parse_title(source, &mut title_end, budget)?
            && let Some(end) = line_end(source, title_end)
        {
            return Ok(Some(ParsedDefinition {
                end: leading + end,
                key,
                target: parsed.target,
                title: Some(
                    title
                        .split('\n')
                        .map(|line| line.trim_start_matches([' ', '\t']))
                        .collect::<Vec<_>>()
                        .join("\n"),
                ),
            }));
        }
        // A malformed title on a later line leaves the preceding destination
        // definition valid. An invalid title on the same line invalidates it.
        if !source[destination_end..position].contains('\n') {
            return Ok(None);
        }
    }
    Ok(plain_end.map(|end| ParsedDefinition {
        end: leading + end,
        key,
        target: parsed.target,
        title: None,
    }))
}

fn line_end(source: &str, position: usize) -> Option<usize> {
    let tail = &source[position..];
    let trimmed = tail.trim_start_matches([' ', '\t']);
    let end = position + tail.len() - trimmed.len();
    if trimmed.starts_with('\n') {
        Some(end + 1)
    } else if trimmed.is_empty() {
        Some(end)
    } else {
        None
    }
}
