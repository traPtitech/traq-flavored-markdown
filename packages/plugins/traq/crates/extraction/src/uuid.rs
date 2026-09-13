pub fn is_canonical(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(i, b)| {
            if [8, 13, 18, 23].contains(&i) {
                b == b'-'
            } else {
                b.is_ascii_hexdigit()
            }
        })
}

// Match gofrs/uuid.FromString accepted forms in the existing integration.
pub fn normalize(value: &str) -> Option<String> {
    let value = match value.len() {
        32 | 36 => value,
        34 | 38 => value.strip_prefix('{')?.strip_suffix('}')?,
        41 | 45 => value.strip_prefix("urn:uuid:")?,
        _ => return None,
    };

    if is_canonical(value) {
        return Some(value.to_ascii_lowercase());
    }

    if value.len() != 32 || !value.bytes().all(|b| b.is_ascii_hexdigit()) {
        return None;
    }

    Some(
        format!(
            "{}-{}-{}-{}-{}",
            &value[..8],
            &value[8..12],
            &value[12..16],
            &value[16..20],
            &value[20..]
        )
        .to_ascii_lowercase(),
    )
}
