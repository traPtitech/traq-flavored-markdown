pub(super) fn path_end(text: &str, start: usize) -> usize {
    if !text[start..].starts_with(['/', '?', '#']) {
        return start;
    }

    let mut end = start;
    let mut pairs = vec![];
    let mut quoted_until = 0;

    for (offset, ch) in text[start..].char_indices() {
        let position = start + offset;
        if position < quoted_until {
            end = position + ch.len_utf8();
            continue;
        }
        if ch.is_whitespace() || ch.is_control() || "<>｜".contains(ch) {
            break;
        }
        if ch == '"' || ch == '\'' {
            let tail = &text[position + 1..];
            if let Some(close) = tail.find(|c: char| c == ch || c.is_whitespace() || c.is_control())
                && close > 0
                && tail.as_bytes()[close] == ch as u8
            {
                quoted_until = position + close + 2;
            } else if ch == '"'
                || !tail
                    .chars()
                    .next()
                    .is_some_and(|c| c.is_alphanumeric() || c == '-')
            {
                break;
            }
        }
        if let Some(close) = match ch {
            '(' => Some(')'),
            '[' => Some(']'),
            '{' => Some('}'),
            _ => None,
        } {
            pairs.push((close, position));
        } else if ")]}".contains(ch) {
            if pairs.last().is_none_or(|(close, _)| *close != ch) {
                break;
            }
            pairs.pop();
        }
        end = position + ch.len_utf8();
    }
    if let Some((_, open)) = pairs.first() {
        end = *open;
    }
    let stopped_at_quote = text[end..].starts_with(['\'', '"']);
    while end > start
        && (text[..end].ends_with('*')
            || !stopped_at_quote && text[..end].ends_with(['.', ',', ';', '!', '?']))
    {
        end -= 1;
    }
    if end == start + 1 && !text[start..].starts_with('/') {
        start
    } else {
        end
    }
}
