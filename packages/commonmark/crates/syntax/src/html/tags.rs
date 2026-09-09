use regex::Regex;
use std::sync::LazyLock;

// CommonMark 0.31.2 §6.6: a whitespace gap contains at most one line ending.
fn open_close() -> String {
    let ws = r"[ \t]*(?:\n[ \t]*)?";
    let gap = r"(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)";
    let name = r"[A-Za-z_:][A-Za-z0-9:._-]*";
    let value = r#"(?:[^ \t\n\r"'=<>`]+|'[^']*'|"[^"]*")"#;
    let attribute = format!(r"{gap}{name}(?:{ws}={ws}{value})?");

    format!(r"(?:<[A-Za-z][A-Za-z0-9-]*(?:{attribute})*{ws}/?>|</[A-Za-z][A-Za-z0-9-]*{ws}>)")
}

pub(super) fn inline_end(source: &str) -> Option<usize> {
    static INLINE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(&format!(
            r"(?s)^(?:{}|<!---?>|<!--.*?-->|<\?.*?\?>|<![A-Za-z][^>]*>|<!\[CDATA\[.*?\]\]>)",
            open_close()
        ))
        .unwrap()
    });

    INLINE.find(source).map(|matched| matched.end())
}
pub(super) fn complete_tag(line: &str) -> bool {
    static TAG: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(&format!(r"^{}[ \t]*$", open_close())).unwrap());

    TAG.is_match(line)
}
