use super::entities::unescape;
use markdown_parser::engine::{Budget, ParseError};

type Destination = Option<(usize, String, Option<String>)>;

pub(crate) fn destination(
    source: &str,
    pos: usize,
    budget: &mut Budget,
    normalize: fn(&str) -> Option<String>,
) -> Result<Destination, ParseError> {
    let bytes = source.as_bytes();

    if bytes.get(pos) != Some(&b'(') {
        return Ok(None);
    }

    let mut i = pos + 1;
    skip_spaces(bytes, &mut i, budget)?;

    let angle = bytes.get(i) == Some(&b'<');
    if angle {
        i += 1;
    }

    let start = i;
    let Some(end) = scan_destination(bytes, start, angle, budget)? else {
        return Ok(None);
    };
    i = end;

    let Some(url) = normalize(&unescape(&source[start..i])) else {
        return Ok(None);
    };

    if angle {
        i += 1;
    }

    let before_space = i;
    skip_spaces(bytes, &mut i, budget)?;
    let mut title = None;

    if i > before_space
        && bytes
            .get(i)
            .is_some_and(|b| matches!(b, b'"' | b'\'' | b'('))
    {
        let Some(value) = parse_title(source, bytes, &mut i, budget)? else {
            return Ok(None);
        };

        title = Some(value);
        skip_spaces(bytes, &mut i, budget)?;
    }

    if bytes.get(i) != Some(&b')') {
        return Ok(None);
    }

    Ok(Some((i + 1, url, title)))
}

fn skip_spaces(bytes: &[u8], index: &mut usize, budget: &mut Budget) -> Result<(), ParseError> {
    while matches!(bytes.get(*index), Some(b' ' | b'\t' | b'\n')) {
        budget.spend(1)?;
        *index += 1;
    }

    Ok(())
}

fn scan_destination(
    bytes: &[u8],
    start: usize,
    angle: bool,
    budget: &mut Budget,
) -> Result<Option<usize>, ParseError> {
    let mut index = start;
    let mut depth = 0;

    while index < bytes.len() {
        budget.spend(1)?;
        let byte = bytes[index];

        if byte == b'\\' && bytes.get(index + 1).is_some_and(u8::is_ascii_punctuation) {
            index += 2;
            continue;
        }

        if angle {
            if byte == b'>' {
                break;
            }
            if byte == b'<' || byte == b'\n' {
                return Ok(None);
            }
        } else {
            if byte <= 32 || byte == b')' && depth == 0 {
                break;
            }
            if byte == b'(' {
                depth += 1;
                budget.depth(depth)?;
            }
            if byte == b')' {
                depth -= 1;
            }
        }

        index += 1;
    }

    if depth != 0 || angle && bytes.get(index) != Some(&b'>') {
        Ok(None)
    } else {
        Ok(Some(index))
    }
}

fn parse_title(
    source: &str,
    bytes: &[u8],
    index: &mut usize,
    budget: &mut Budget,
) -> Result<Option<String>, ParseError> {
    let Some(&opening) = bytes.get(*index) else {
        return Ok(None);
    };

    let closing = if opening == b'(' { b')' } else { opening };

    *index += 1;
    let start = *index;

    while *index < bytes.len() && bytes[*index] != closing {
        budget.spend(1)?;

        if bytes[*index] == b'\\' && bytes.get(*index + 1).is_some_and(u8::is_ascii_punctuation) {
            *index += 1;
        }

        *index += 1;
    }

    if bytes.get(*index) != Some(&closing) {
        return Ok(None);
    }

    let title = unescape(&source[start..*index]);
    *index += 1;

    Ok(Some(title))
}
