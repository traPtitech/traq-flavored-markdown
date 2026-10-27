use markdown_commonmark::inlines::url::encode;
use regex::Regex;
use std::sync::LazyLock;

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
