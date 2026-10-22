use std::{borrow::Cow, ops::Range};

use fluent_uri::IriRef;
use percent_encoding::{AsciiSet, NON_ALPHANUMERIC, percent_decode_str, utf8_percent_encode};

const ENCODE: &AsciiSet = &NON_ALPHANUMERIC
    .remove(b';')
    .remove(b'/')
    .remove(b'?')
    .remove(b':')
    .remove(b'@')
    .remove(b'&')
    .remove(b'=')
    .remove(b'+')
    .remove(b'$')
    .remove(b',')
    .remove(b'-')
    .remove(b'_')
    .remove(b'.')
    .remove(b'!')
    .remove(b'~')
    .remove(b'*')
    .remove(b'\'')
    .remove(b'(')
    .remove(b')')
    .remove(b'#');

fn escaped_byte(value: &str, offset: usize) -> Option<u8> {
    let digits = value.get(offset + 1..offset + 3)?;
    digits
        .bytes()
        .all(|byte| byte.is_ascii_hexdigit())
        .then(|| u8::from_str_radix(digits, 16).unwrap())
}

/// Syntactic URL encoding; whether a destination may be followed belongs to the host.
pub fn encode(value: &str) -> String {
    let value = host(value, false);
    let Some(hostname) =
        hostname_range(&value).filter(|range| value[range.clone()].starts_with('['))
    else {
        return escape(&value);
    };
    // Brackets delimit an IP literal in the authority, but are escaped in paths.
    format!(
        "{}{}{}",
        escape(&value[..hostname.start]),
        &value[hostname.clone()],
        escape(&value[hostname.end..])
    )
}

fn escape(value: &str) -> String {
    let mut result = String::new();
    let mut start = 0;
    for (offset, _) in value.match_indices('%') {
        if escaped_byte(value, offset).is_some() {
            result.extend(utf8_percent_encode(&value[start..offset], ENCODE));
            result.push_str(&value[offset..offset + 3]);
            start = offset + 3;
        }
    }
    result.extend(utf8_percent_encode(&value[start..], ENCODE));
    result
}

/// Decode a URL for its text label, preserving reserved ASCII characters.
pub fn label(value: &str) -> String {
    let value = host(value, true);
    let mut result = String::new();
    let mut start = 0;
    for (offset, _) in value.match_indices('%') {
        if escaped_byte(&value, offset).is_some_and(|byte| b";/?:@&=+$,#%".contains(&byte)) {
            result.push_str(&percent_decode_str(&value[start..offset]).decode_utf8_lossy());
            result.push_str(&value[offset..offset + 3]);
            start = offset + 3;
        }
    }
    result.push_str(&percent_decode_str(&value[start..]).decode_utf8_lossy());
    result
}

fn hostname_range(value: &str) -> Option<Range<usize>> {
    let rest = if let Some(rest) = value.strip_prefix("//") {
        rest
    } else {
        let (scheme, rest) = value.split_once(':')?;
        if scheme.eq_ignore_ascii_case("mailto") {
            rest.strip_prefix("//").unwrap_or(rest)
        } else {
            rest.strip_prefix("//")?
        }
    };

    // Parse only the authority: Markdown paths can contain spaces or malformed
    // percent escapes, which are handled separately by encode/label.
    let end = rest.find(['/', '?', '#']).unwrap_or(rest.len());
    let reference = format!("//{}", &rest[..end]);
    let iri = IriRef::parse(reference.as_str()).ok()?;
    let authority = iri.authority()?;
    let start = value.len() - rest.len() + authority.userinfo().map_or(0, |info| info.len() + 1);
    Some(start..start + authority.host().len())
}

fn host(value: &str, decode: bool) -> Cow<'_, str> {
    let value = value.trim();
    if !["//", "http:", "https:", "mailto:"]
        .iter()
        .any(|prefix| value.starts_with(prefix))
    {
        return value.into();
    }
    let Some(range) = hostname_range(value) else {
        return value.into();
    };
    let hostname = &value[range.clone()];
    let mut dns_label = true;
    let replacement = hostname
        .split(['.', '\u{3002}', '\u{ff0e}', '\u{ff61}'])
        .map(|part| {
            // Recode the DNS-like prefix only. IRI reg-names also allow other
            // characters; preserve those literally instead of changing meaning.
            dns_label &= part.chars().count() <= 63
                && part.chars().all(|ch| {
                    !ch.is_ascii() || ch.is_ascii_alphanumeric() || matches!(ch, '+' | '-' | '_')
                });
            if !dns_label {
                part.into()
            } else if decode {
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
    format!(
        "{}{}{}",
        &value[..range.start],
        replacement,
        &value[range.end..]
    )
    .into()
}

#[cfg(test)]
mod tests {
    use super::{encode, label};

    #[test]
    fn escaping_preserves_existing_escapes_and_encodes_invalid_ones() {
        assert_eq!(
            encode("/a b/%2f/%2F/%25/%zz/%é/%+A/日本/[x]\\\0"),
            "/a%20b/%2f/%2F/%25/%25zz/%25%C3%A9/%25+A/%E6%97%A5%E6%9C%AC/%5Bx%5D%5C%00"
        );
        assert_eq!(encode(";/?:@&=+$,-_.!~*'()#"), ";/?:@&=+$,-_.!~*'()#");
    }

    #[test]
    fn every_escaped_byte_keeps_its_spelling_and_reserved_label_characters() {
        for byte in 0..=255u8 {
            for escaped in [format!("%{byte:02x}"), format!("%{byte:02X}")] {
                assert_eq!(encode(&escaped), escaped);
                let expected = if b";/?:@&=+$,#%".contains(&byte) {
                    escaped.clone()
                } else {
                    String::from_utf8_lossy(&[byte]).into_owned()
                };
                assert_eq!(label(&escaped), expected, "{escaped}");
            }
        }
    }

    #[test]
    fn labels_decode_unicode_lossily_without_changing_reserved_escapes() {
        assert_eq!(label("/%E6%97%A5%E6%9C%AC/%20/%2f/%25"), "/日本/ /%2f/%25");
        assert_eq!(label("/%E3%95%2F/%FF/%2g/%é/%+A"), "/�%2F/�/%2g/%é/%+A");
    }

    #[test]
    fn host_recoding_preserves_userinfo_ports_paths_and_relative_notation() {
        for (input, encoded, decoded) in [
            (
                "https://user:pass@bücher.example:443/a/../b?q=%2f#x",
                "https://user:pass@xn--bcher-kva.example:443/a/../b?q=%2f#x",
                "https://user:pass@bücher.example:443/a/../b?q=%2f#x",
            ),
            (
                "//bücher.example/a b/%zz",
                "//xn--bcher-kva.example/a%20b/%25zz",
                "//bücher.example/a b/%zz",
            ),
            (
                "mailto:user@bücher.example?subject=%20",
                "mailto:user@xn--bcher-kva.example?subject=%20",
                "mailto:user@bücher.example?subject= ",
            ),
            (
                "../a/../b?q=%2f#x",
                "../a/../b?q=%2f#x",
                "../a/../b?q=%2f#x",
            ),
            (
                "http://[::1]:80/a",
                "http://[::1]:80/a",
                "http://[::1]:80/a",
            ),
            (
                "HTTPS://user:pass@[2001:db8::1]:443/a[0]",
                "HTTPS://user:pass@[2001:db8::1]:443/a%5B0%5D",
                "HTTPS://user:pass@[2001:db8::1]:443/a[0]",
            ),
        ] {
            assert_eq!(encode(input), encoded, "{input}");
            assert_eq!(label(input), decoded, "{input}");
        }
        assert_eq!(
            label("https://xn--bcher-kva.example"),
            "https://bücher.example"
        );
    }

    #[test]
    fn malformed_unicode_authorities_preserve_input_and_ports() {
        for host in ["😀!", "abc.é!", "é.!x.😀", "abc.!x.é"] {
            for padding in ["", " ", "\n\t", "\u{2003}"] {
                for port in ["", ":80", ":invalid"] {
                    let input = format!("{padding}http://{host}{port}/path?x=1#frag{padding}");
                    assert_eq!(label(&input), input.trim(), "{input:?}");
                    assert!(encode(&input).ends_with(&format!("{port}/path?x=1#frag")));
                }
            }
        }
    }
}
