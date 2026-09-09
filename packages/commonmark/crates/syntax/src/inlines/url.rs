/// Apply the markdown-it-compatible destination policy and URL encoding.
///
/// Extensions can share this policy; the parser core does not select or call it.
/// Rendering hosts must still enforce their own policy before following a URL.
pub fn normalize(value: &str) -> Option<String> {
    let lower = value.trim().to_ascii_lowercase();

    if ["javascript:", "vbscript:", "file:"]
        .iter()
        .any(|s| lower.starts_with(s))
    {
        return None;
    }

    if lower.starts_with("data:")
        && !["gif", "png", "jpeg", "webp"]
            .iter()
            .any(|ext| lower.starts_with(&format!("data:image/{ext};")))
    {
        return None;
    }

    Some(encode(value))
}

/// Syntactic URL encoding; whether a destination may be followed belongs to the host.
pub fn encode(value: &str) -> String {
    mdurl::urlencode::encode(
        &host(value, false),
        mdurl::urlencode::ENCODE_DEFAULT_CHARS,
        true,
    )
    .into_owned()
}

/// Decode a URL for its text label, preserving reserved ASCII characters.
pub fn label(value: &str) -> String {
    mdurl::urlencode::decode(
        &host(value, true),
        mdurl::urlencode::AsciiSet::from(";/?:@&=+$,#%"),
    )
    .into_owned()
}

fn host(value: &str, decode: bool) -> String {
    let mut url = mdurl::parse_url(value);

    if matches!(
        url.protocol.as_deref(),
        None | Some("http:" | "https:" | "mailto:")
    ) && let Some(host) = &mut url.hostname
    {
        *host = host
            .split(['.', '\u{3002}', '\u{ff0e}', '\u{ff61}'])
            .map(|part| {
                if decode {
                    part.strip_prefix("xn--")
                        .and_then(|s| idna::punycode::decode_to_string(&s.to_lowercase()))
                        .unwrap_or_else(|| part.into())
                } else if !part.is_ascii() {
                    idna::punycode::encode_str(part)
                        .map(|s| format!("xn--{s}"))
                        .unwrap_or_else(|| part.into())
                } else {
                    part.into()
                }
            })
            .collect::<Vec<_>>()
            .join(".");
    }

    url.to_string()
}
