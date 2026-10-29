use super::path::path_end;
use markdown_commonmark::inlines::url::{encode, label};
use regex::Regex;
use std::sync::LazyLock;

pub(super) struct Match {
    pub start: usize,
    pub end: usize,
    pub destination: String,
    pub label: String,
}

fn bare_pattern() -> &'static Regex {
    static PATTERN: LazyLock<Regex> = LazyLock::new(|| {
        let letter = r"[^\p{P}\p{Z}\p{C}<>｜]";
        let domain = format!(r"{letter}(?:(?:{letter}|-)*{letter})?");
        let host = format!(r"{domain}(?:\.{domain})*");
        let local = r"[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}";
        let mail_host = r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?";
        Regex::new(&format!(
            r"(?i)(?:(?:(?:https?|ftp)://|(?P<relative>//))(?:[^\s@/\[\]()<>]{{1,50}}@)?(?P<host>{host}|\[[0-9a-f:.]+\])(?P<port>:[0-9]{{1,5}})?|(?P<mail>mailto:)?(?P<email>{local}@(?P<email_host>{mail_host}(?:\.{mail_host})+)))"
        ))
        .expect("valid URL and email pattern")
    });
    &PATTERN
}

pub(super) fn scan_len(tail: &str) -> usize {
    // Reject comment-like prefixes before scanning a potentially long path.
    if let Some(relative) = tail.strip_prefix("//") {
        let authority = relative
            .split(|ch: char| ch.is_whitespace() || ch.is_control() || "/?#".contains(ch))
            .next()
            .unwrap_or_default();
        if !authority.contains('.') && !authority.contains('[') {
            return 0;
        }
    }
    tail.find(|ch: char| ch.is_whitespace() || ch.is_control())
        .unwrap_or(tail.len())
}

pub(super) fn bare_at(text: &str, position: usize, length: usize) -> Option<Match> {
    let candidate = bare_pattern().captures(&text[position..position + length])?;
    if candidate.get(0)?.start() != 0 {
        return None;
    }
    bare_match(text, candidate, position)
}

pub(super) fn bare_urls(text: &str) -> Vec<Match> {
    let mut occupied = 0;
    bare_pattern()
        .captures_iter(text)
        .filter_map(|candidate| {
            if candidate.get(0)?.start() < occupied {
                return None;
            }
            let found = bare_match(text, candidate, 0)?;
            occupied = found.end;
            Some(found)
        })
        .collect()
}

fn bare_match(text: &str, candidate: regex::Captures<'_>, offset: usize) -> Option<Match> {
    let matched = candidate.get(0)?;
    let start = offset + matched.start();
    let email = candidate.name("email").is_some();
    let relative = candidate.name("relative").is_some();
    // Case-insensitive regex matching also accepts Unicode aliases of ASCII
    // letters. Bare email syntax uses the ASCII CommonMark character set.
    if email && !candidate.name("email")?.as_str().is_ascii() {
        return None;
    }
    if text[..start].chars().next_back().is_some_and(|ch| {
        ch.is_ascii_alphanumeric()
            || if email {
                ".!#$%&'*+/=?^_`{|}~-@".contains(ch)
            } else if relative {
                "+-/:;.&\\".contains(ch)
            } else {
                "+-".contains(ch)
            }
    }) {
        return None;
    }
    let host = candidate
        .name("host")
        .or_else(|| candidate.name("email_host"))?
        .as_str();
    if relative && !host.contains('.') && !host.starts_with('[') {
        return None;
    }
    if host.starts_with('[') {
        host[1..host.len() - 1].parse::<std::net::Ipv6Addr>().ok()?;
    }
    if host.split('.').any(|part| part.encode_utf16().count() > 63) {
        return None;
    }
    let port = candidate.name("port");
    if let Some(port) = port {
        port.as_str()[1..].parse::<u16>().ok()?;
    }
    let end = offset + matched.end();
    static TERMINATOR: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"^(?:[\p{P}\p{Z}\p{C}<>｜]|$)").unwrap());
    let prose_after_port =
        port.is_some() && text[end..].chars().next().is_some_and(|ch| !ch.is_ascii());
    if (!TERMINATOR.is_match(&text[end..]) && !prose_after_port)
        || text[end..].starts_with(['-', '_'])
        || text[end..].strip_prefix('.').is_some_and(|tail| {
            let tail = tail.trim_start_matches('.');
            tail.starts_with('-') || !TERMINATOR.is_match(tail)
        })
    {
        return None;
    }
    let end = if email { end } else { path_end(text, end) };
    let raw = &text[start..end];
    let destination = if relative {
        let host_start = offset + candidate.name("host")?.start();
        encode(&format!(
            "https:{}{}{}",
            &text[start..host_start],
            host.to_ascii_lowercase(),
            &text[host_start + host.len()..end]
        ))
    } else if email && candidate.name("mail").is_none() {
        encode(&format!("mailto:{raw}"))
    } else {
        encode(raw)
    };
    Some(Match {
        start,
        end,
        destination,
        label: if email { raw.into() } else { label(raw) },
    })
}

pub(super) fn destination(value: &str) -> Option<String> {
    static AUTHORITY: LazyLock<Regex> = LazyLock::new(|| {
        let letter = r"[^\p{P}\p{Z}\p{C}<>｜]";
        let domain = format!(r"{letter}(?:(?:{letter}|-)*{letter})?");
        Regex::new(&format!(
            r"^(?P<host>{domain}(?:\.{domain})+)(?::(?P<port>[0-9]{{1,5}}))?$"
        ))
        .expect("valid angle-domain authority pattern")
    });

    let value = value.strip_prefix("//").unwrap_or(value);
    let authority_end = value.find(['/', '?', '#']).unwrap_or(value.len());
    let authority = &value[..authority_end];
    let matched = AUTHORITY.captures(authority)?;
    let host = matched.name("host")?.as_str();
    if host.split('.').any(|part| part.encode_utf16().count() > 63) {
        return None;
    }
    if let Some(port) = matched.name("port") {
        port.as_str().parse::<u16>().ok()?;
    }

    Some(encode(&format!(
        "https://{}{}{}",
        host.to_ascii_lowercase(),
        &authority[host.len()..],
        &value[authority_end..],
    )))
}
