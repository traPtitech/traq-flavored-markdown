use super::entities::decode_entity;

use markdown_parser::{
    NodeKind, ParseError,
    engine::{
        Budget,
        inline::{InlineAction, InlineInput, InlineMatch},
    },
};

pub(super) fn escape(
    input: &InlineInput<'_>,
    budget: &mut Budget,
) -> Result<Option<InlineMatch>, ParseError> {
    let pos = input.position;
    let bytes = input.source.text().as_bytes();

    match bytes.get(pos + 1).copied() {
        Some(b'\n') => {
            let mut end = pos + 2;
            while matches!(bytes.get(end), Some(b' ' | b'\t')) {
                budget.spend(1)?;
                end += 1;
            }

            Ok(Some(InlineMatch::leaf(
                end,
                NodeKind::new(markdown_commonmark_contracts::Hardbreak {}),
            )))
        }

        Some(c) if c.is_ascii_punctuation() => {
            Ok(Some(InlineMatch::text(pos + 2, (c as char).to_string())))
        }

        _ => Ok(None),
    }
}

pub(super) fn newline(
    input: &InlineInput<'_>,
    budget: &mut Budget,
) -> Result<Option<InlineMatch>, ParseError> {
    let trim = input.trailing_text.len() - input.trailing_text.trim_end_matches(' ').len();
    let mut end = input.position + 1;

    while matches!(input.source.text().as_bytes().get(end), Some(b' ' | b'\t')) {
        budget.spend(1)?;
        end += 1;
    }

    Ok(Some(InlineMatch {
        end,
        action: InlineAction::TrimmedNode {
            trim,
            kind: if trim >= 2 {
                NodeKind::new(markdown_commonmark_contracts::Hardbreak {})
            } else {
                NodeKind::new(markdown_commonmark_contracts::Softbreak {})
            },
        },
    }))
}

pub(super) fn entity(
    input: &InlineInput<'_>,
    budget: &mut Budget,
) -> Result<Option<InlineMatch>, ParseError> {
    let Some((length, value)) = decode_entity(input.tail(), 7, 6) else {
        return Ok(None);
    };

    budget.spend(length)?;
    Ok(Some(InlineMatch::text(input.position + length, value)))
}

pub(super) fn code(
    input: &InlineInput<'_>,
    budget: &mut Budget,
) -> Result<Option<InlineMatch>, ParseError> {
    let pos = input.position;
    let source = &input.source.text();
    let bytes = source.as_bytes();

    let mut open_end = pos;

    while bytes.get(open_end) == Some(&b'`') {
        budget.spend(1)?;
        open_end += 1;
    }

    let Some((start, end)) = closing_code(bytes, open_end, open_end - pos, budget)? else {
        return Ok(Some(InlineMatch::literal(open_end)));
    };

    let mut literal = source[open_end..start].replace('\n', " ");

    if literal.starts_with(' ') && literal.ends_with(' ') && literal.bytes().any(|b| b != b' ') {
        literal = literal[1..literal.len() - 1].into();
    }

    Ok(Some(InlineMatch::leaf(
        end,
        NodeKind::new(markdown_commonmark_contracts::InlineCode { literal }),
    )))
}

fn closing_code(
    bytes: &[u8],
    mut end: usize,
    length: usize,
    budget: &mut Budget,
) -> Result<Option<(usize, usize)>, ParseError> {
    // Searches are bounded by the shared work budget, including failed closers.
    while end < bytes.len() {
        budget.spend(1)?;

        if bytes[end] != b'`' {
            end += 1;
            continue;
        }

        let start = end;

        while bytes.get(end) == Some(&b'`') {
            budget.spend(1)?;
            end += 1;
        }

        if end - start == length {
            return Ok(Some((start, end)));
        }
    }

    Ok(None)
}
