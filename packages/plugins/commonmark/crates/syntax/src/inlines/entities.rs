#[path = "entities_table.rs"]
mod table;

pub fn unescape(source: &str) -> String {
    let mut value = String::new();
    let mut i = 0;

    while i < source.len() {
        let bytes = source.as_bytes();

        if bytes[i] == b'\\' && bytes.get(i + 1).is_some_and(u8::is_ascii_punctuation) {
            value.push(bytes[i + 1] as char);
            i += 2;
            continue;
        }

        if bytes[i] == b'&'
            && let Some((len, decoded)) = decode_entity(&source[i..], 8, 8)
        {
            value.push_str(&decoded);
            i += len;
            continue;
        }

        let ch = source[i..].chars().next().unwrap();
        value.push(ch);
        i += ch.len_utf8();
    }

    value
}

pub(crate) fn decode_entity(
    source: &str,
    decimal_limit: usize,
    hex_limit: usize,
) -> Option<(usize, String)> {
    let mut end = 1;

    while end < source.len()
        && end <= 34
        && (source.as_bytes()[end].is_ascii_alphanumeric() || source.as_bytes()[end] == b'#')
    {
        end += 1;
    }

    if source.as_bytes().get(end) != Some(&b';') {
        return None;
    }

    let name = &source[1..end];

    let decoded = if let Some(digits) = name.strip_prefix('#') {
        decode_numeric(digits, decimal_limit, hex_limit)?
    } else {
        decode_named(name)?
    };

    Some((end + 1, decoded))
}

fn decode_numeric(digits: &str, decimal_limit: usize, hex_limit: usize) -> Option<String> {
    let (digits, radix, limit) = if digits.starts_with(['x', 'X']) {
        (&digits[1..], 16, hex_limit)
    } else {
        (digits, 10, decimal_limit)
    };

    if digits.is_empty() || digits.len() > limit || !digits.chars().all(|c| c.is_digit(radix)) {
        return None;
    }

    let code = u32::from_str_radix(digits, radix).ok()?;

    let valid = !matches!(code, 0..=8 | 11 | 14..=31 | 127..=159 | 0xfdd0..=0xfdef)
        && code & 0xffff != 0xffff
        && code & 0xffff != 0xfffe;

    let character = if valid {
        char::from_u32(code).unwrap_or('\u{fffd}')
    } else {
        '\u{fffd}'
    };

    Some(character.to_string())
}

fn decode_named(name: &str) -> Option<String> {
    if !(2..=32).contains(&name.len()) || !name.as_bytes()[0].is_ascii_alphabetic() {
        return None;
    }

    let index = table::NAMED
        .binary_search_by_key(&name, |(name, _)| *name)
        .ok()?;

    Some(table::NAMED[index].1.into())
}
