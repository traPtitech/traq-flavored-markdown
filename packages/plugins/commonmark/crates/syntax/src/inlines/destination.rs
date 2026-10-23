use super::{entities::unescape, url};
use markdown_parser::ParseError;
use markdown_parser::rules::Budget;
use markdown_parser::source::Cursor;
use markdown_parser::source::ViewOffset;

pub(crate) struct ParsedDestination {
    pub end: usize,
    pub target: String,
    pub title: Option<String>,
}

pub(crate) struct ParsedTarget {
    pub end: ViewOffset,
    pub target: String,
}

pub(crate) fn destination(
    source: &str,
    pos: usize,
    budget: &mut Budget,
) -> Result<Option<ParsedDestination>, ParseError> {
    let bytes = source.as_bytes();

    if bytes.get(pos) != Some(&b'(') {
        return Ok(None);
    }

    let mut i = pos + 1;
    skip_spaces(source, &mut i, budget)?;

    let Some(parsed) = target(source, i, budget)? else {
        return Ok(None);
    };
    i = parsed.end.get();

    let before_space = i;
    skip_spaces(source, &mut i, budget)?;
    let mut title = None;

    if i > before_space
        && bytes
            .get(i)
            .is_some_and(|b| matches!(b, b'"' | b'\'' | b'('))
    {
        let Some(value) = parse_title(source, &mut i, budget)? else {
            return Ok(None);
        };

        title = Some(value);
        skip_spaces(source, &mut i, budget)?;
    }

    if bytes.get(i) != Some(&b')') {
        return Ok(None);
    }

    Ok(Some(ParsedDestination {
        end: i + 1,
        target: parsed.target,
        title,
    }))
}

pub(crate) fn skip_spaces(
    source: &str,
    index: &mut usize,
    budget: &mut Budget,
) -> Result<(), ParseError> {
    let mut cursor = Cursor::from_byte_index(source, *index, budget)?;
    cursor.skip_while(|ch| matches!(ch, ' ' | '\t' | '\n'))?;
    *index = cursor.position().get();
    Ok(())
}

/// Scan a destination on the original input; callers own their delimiters.
pub(crate) fn target(
    source: &str,
    position: usize,
    budget: &mut Budget,
) -> Result<Option<ParsedTarget>, ParseError> {
    let mut cursor = Cursor::from_byte_index(source, position, budget)?;
    let angle = cursor.peek() == Some('<');
    if angle {
        cursor.next_char()?;
    }
    let start = cursor.position();
    let mut depth = 0;
    while let Some(ch) = cursor.peek() {
        if ch == '\\'
            && cursor
                .tail()
                .as_bytes()
                .get(1)
                .is_some_and(u8::is_ascii_punctuation)
        {
            cursor.advance(2)?;
            continue;
        }
        if angle {
            if ch == '>' {
                break;
            }
            if ch == '<' || ch == '\n' {
                return Ok(None);
            }
        } else {
            if ch <= ' ' || ch == ')' && depth == 0 {
                break;
            }
            if ch == '(' {
                depth += 1;
                cursor.nesting(depth)?;
            }
            if ch == ')' {
                depth -= 1;
            }
        }
        cursor.next_char()?;
    }
    if depth != 0 || angle && cursor.peek() != Some('>') {
        return Ok(None);
    }
    let end = cursor.position();
    if angle {
        cursor.next_char()?;
    }
    Ok(Some(ParsedTarget {
        end: cursor.position(),
        target: url::encode(&unescape(&source[start.get()..end.get()])),
    }))
}

pub(crate) fn parse_title(
    source: &str,
    index: &mut usize,
    budget: &mut Budget,
) -> Result<Option<String>, ParseError> {
    let mut cursor = Cursor::from_byte_index(source, *index, budget)?;
    let Some(opening) = cursor.next_char()? else {
        return Ok(None);
    };
    let closing = if opening == '(' { ')' } else { opening };
    let start = cursor.position();
    while let Some(ch) = cursor.peek() {
        if ch == closing {
            break;
        }
        if ch == '\\'
            && cursor
                .tail()
                .as_bytes()
                .get(1)
                .is_some_and(u8::is_ascii_punctuation)
        {
            cursor.advance(2)?;
        } else {
            cursor.next_char()?;
        }
    }
    if cursor.peek() != Some(closing) {
        return Ok(None);
    }
    let title = unescape(&source[start.get()..cursor.position().get()]);
    cursor.next_char()?;
    *index = cursor.position().get();
    Ok(Some(title))
}
