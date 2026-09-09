pub(super) fn blank(line: &str) -> bool {
    line.bytes().all(|b| b == b' ' || b == b'\t')
}

pub(super) fn ascii_space(ch: char) -> bool {
    matches!(ch, ' ' | '\t' | '\n' | '\r')
}

pub(super) fn content<'a>(
    source: &'a markdown_parser::engine::source::SourceView,
    line: &std::ops::Range<usize>,
) -> &'a str {
    source.text()[line.clone()].trim_end_matches('\n')
}

pub(super) fn underline(line: &str) -> Option<u8> {
    if line.starts_with("    ") || line.starts_with('\t') {
        return None;
    }

    let line = line.trim_matches(ascii_space);
    let marker = *line.as_bytes().first()?;

    (matches!(marker, b'=' | b'-') && line.bytes().all(|b| b == marker))
        .then_some(if marker == b'=' { 1 } else { 2 })
}

pub(super) fn fence(line: &str) -> Option<(u8, usize, &str)> {
    let text = line.trim_start_matches(' ');

    if line.len() - text.len() > 3 {
        return None;
    }

    let marker = *text.as_bytes().first()?;

    if !b"`~".contains(&marker) {
        return None;
    }

    let count = text.bytes().take_while(|b| *b == marker).count();
    let info = text[count..].trim();

    (count >= 3 && (marker != b'`' || !info.contains('`'))).then_some((marker, count, info))
}

pub(super) fn heading(line: &str) -> Option<(u8, usize)> {
    let indent = line.len() - line.trim_start_matches(' ').len();

    if indent > 3 {
        return None;
    }

    let line = &line[indent..];
    let level = line.bytes().take_while(|b| *b == b'#').count();
    let valid_level = (1..=6).contains(&level);
    let has_separator = line.len() == level || line[level..].starts_with([' ', '\t']);

    if !valid_level || !has_separator {
        return None;
    }

    Some((
        level as u8,
        indent + level + line[level..].len() - line[level..].trim_start().len(),
    ))
}

pub(super) fn thematic(line: &str) -> bool {
    let mut chars = line.bytes().filter(|b| !b.is_ascii_whitespace());

    let Some(marker) = chars.next() else {
        return false;
    };

    b"-*_".contains(&marker) && chars.clone().count() >= 2 && chars.all(|b| b == marker)
}

// Prefix width, ordered, starting number. Indentation is handled by the caller.
pub(super) struct Marker {
    pub content: usize,
    pub width: usize,
    pub ordered: bool,
    pub start: u32,
    pub delimiter: u8,
    pub text: String,
}

pub(super) fn item(line: &str) -> Option<Marker> {
    let indent = line.len() - line.trim_start_matches(' ').len();

    if indent > 3 {
        return None;
    }

    let line = &line[indent..];
    let bytes = line.as_bytes();
    let count = bytes.iter().take_while(|b| b.is_ascii_digit()).count();
    let (end, ordered, start) =
        if count > 0 && count <= 9 && matches!(bytes.get(count), Some(b'.' | b')')) {
            (count + 1, true, line[..count].parse().ok()?)
        } else if matches!(bytes.first(), Some(b'-' | b'+' | b'*')) {
            (1, false, 1)
        } else {
            return None;
        };

    if !matches!(bytes.get(end), None | Some(b' ' | b'\t')) {
        return None;
    }

    let spaces = line[end..]
        .bytes()
        .take_while(|b| *b == b' ' || *b == b'\t')
        .count();

    let after = if spaces > 4 || end + spaces == line.len() {
        1
    } else {
        spaces.max(1)
    };

    Some(Marker {
        content: indent + end + spaces.min(after),
        width: indent + end + after,
        ordered,
        start,
        delimiter: bytes[end - 1],
        text: line[..end].into(),
    })
}

pub(super) fn quote(line: &str) -> Option<usize> {
    let indent = line.len() - line.trim_start_matches(' ').len();

    if indent > 3 {
        return None;
    }

    line[indent..]
        .strip_prefix('>')
        .map(|rest| indent + 1 + usize::from(rest.starts_with(' ')))
}
