pub(super) fn path_end(text: &str, start: usize) -> usize {
    if !text[start..].starts_with(['/', '?', '#']) {
        return start;
    }

    let mut end = start;
    let mut pairs = vec![];
    let mut quoted_until = 0;

    for (offset, ch) in text[start..].char_indices() {
        let position = start + offset;

        // Count only brackets inside this URL, not an enclosing prose opener.
        // Match parentheses even in quoted path segments. An unmatched closing
        // parenthesis ends the URL immediately, before any following prose.
        if ch == '(' {
            pairs.push((')', position));
        } else if ch == ')' {
            if pairs.last().is_none_or(|(close, _)| *close != ')') {
                break;
            }

            pairs.pop();
        }

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
            '[' => Some(']'),
            '{' => Some('}'),
            _ => None,
        } {
            pairs.push((close, position));
        } else if "]}".contains(ch) {
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

    // Keep terminal underscores and hyphens, which commonly belong to URL
    // identifiers. Other prose/formatting punctuation follows GFM trimming;
    // interior tildes remain URL text. Explicit links bypass this scan.
    while end > start {
        let last = text[..end].chars().next_back().unwrap();

        if last == ';' {
            // Inspect only the final alphanumeric run, so a long run of
            // semicolons cannot repeatedly scan the entire path.
            let suffix = &text[start..end - 1];
            if let Some(index) = suffix.rfind(|ch: char| !ch.is_ascii_alphanumeric())
                && suffix.as_bytes()[index] == b'&'
                && index + 1 < suffix.len()
            {
                end = start + index;
                continue;
            }
        }

        if "?!.,:*~;".contains(last) {
            end -= last.len_utf8();
        } else {
            break;
        }
    }

    if end == start + 1 && !text[start..].starts_with('/') {
        start
    } else {
        end
    }
}
