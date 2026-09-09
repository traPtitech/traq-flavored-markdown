use super::path::path_end;
use markdown_commonmark::inlines::url::{label, normalize};
use regex::Regex;
use std::sync::LazyLock;

// Frozen linkify-it 5 default TLDs, plus the S-UI additions. This is syntax,
// deliberately independent of DNS and the current public suffix registry.
static TLD: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(concat!(
        "(?i)^(?:biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф|app|dev|games|tech|show|xn--[a-z0-9-]{1,59}|",
        "a[cdefgilmnoqrstuwxz]|b[abdefghijmnorstvwyz]|c[acdfghiklmnoruvwxyz]|d[ejkmoz]|e[cegrstu]|f[ijkmor]|g[abdefghilmnpqrstuwy]|h[kmnrtu]|i[delmnoqrst]|j[emop]|k[eghimnprwyz]|l[abcikrstuvy]|m[acdeghklmnopqrstuvwxyz]|n[acefgilopruz]|om|p[aefghklmnrstwy]|qa|r[eosuw]|s[abcdeghijklmnortuvxyz]|t[cdfghjklmnortvwz]|u[agksyz]|v[aceginu]|w[fs]|y[et]|z[amw])$"
    )).unwrap()
});

pub(crate) struct Match {
    pub start: usize,
    pub end: usize,
    pub destination: String,
    pub label: String,
}

pub(super) fn find(text: &str) -> Vec<Match> {
    find_impl(text, None)
}

pub(super) fn at(text: &str, position: usize) -> Option<Match> {
    find_impl(text, Some(position)).into_iter().next()
}

fn find_impl(text: &str, position: Option<usize>) -> Vec<Match> {
    static CANDIDATE: LazyLock<Regex> = LazyLock::new(|| {
        let letter = r"[^\p{P}\p{Z}\p{C}<>｜]";

        // Check the 63-character domain limit below; bounded Unicode repetitions
        // unnecessarily inflate the regex automaton in Wasm.
        let domain = format!(r"{letter}(?:(?:{letter}|-)*{letter})?");
        let host = format!(r"{domain}(?:\.{domain})*");

        // Reject invalid TLDs during matching, so a failed fuzzy host cannot
        // consume an explicit scheme later in the same run of text.
        let tld = TLD
            .as_str()
            .strip_prefix("(?i)^")
            .unwrap()
            .strip_suffix('$')
            .unwrap();

        let authority =
            format!(r"//(?:[^\s@/\[\]()<>]{{1,50}}@)?(?P<host>{host})(?P<port>:[0-9]{{1,5}})?");
        Regex::new(&format!(r#"(?i)(?:(?P<scheme>https?:|ftp:)?{authority}|(?P<mail>mailto:)?(?P<email>[-;:&=+$,.a-z0-9_][-;:&=+$,".a-z0-9_]{{0,63}}@{host})|(?P<fuzzy>{domain}(?:\.{domain})*\.{tld})(?P<fport>:[0-9]{{1,5}})?)"#)).unwrap()
    });

    let mut occupied = 0;
    let candidates: Box<dyn Iterator<Item = regex::Captures<'_>> + '_> =
        if let Some(position) = position {
            Box::new(
                CANDIDATE
                    .captures_at(text, position)
                    .into_iter()
                    .filter(move |capture| capture.get(0).is_some_and(|m| m.start() == position)),
            )
        } else {
            Box::new(CANDIDATE.captures_iter(text))
        };

    candidates
        .filter_map(|candidate| match_candidate(text, candidate, &mut occupied))
        .collect()
}

fn match_candidate(
    text: &str,
    candidate: regex::Captures<'_>,
    occupied: &mut usize,
) -> Option<Match> {
    let matched = candidate.get(0)?;
    let start = matched.start();

    if start < *occupied {
        return None;
    }

    let before = text[..start].chars().next_back();
    let explicit = candidate.name("scheme").is_some();
    let email = candidate.name("email").is_some();

    if email
        && candidate.name("mail").is_none()
        && before.is_some_and(|c| c.is_ascii_alphanumeric() || "._%+-/@".contains(c))
    {
        return None;
    }

    let relative = candidate.name("host").is_some() && !explicit;
    if !explicit && before.is_some_and(|c| ".:/-_@".contains(c)) {
        return None;
    }

    if explicit && before.is_some_and(|c| c.is_ascii_alphanumeric() || "+-".contains(c)) {
        return None;
    }

    let host = candidate
        .name("host")
        .or_else(|| candidate.name("fuzzy"))
        .or_else(|| candidate.name("email"))?
        .as_str();

    if host
        .rsplit('@')
        .next()?
        .split('.')
        .any(|part| part.encode_utf16().count() > 63)
    {
        return None;
    }

    if (candidate.name("fuzzy").is_some() || email && candidate.name("mail").is_none())
        && !TLD.is_match(host.rsplit('.').next()?)
    {
        return None;
    }

    if relative && !host.contains('.') {
        return None;
    }

    if let Some(port) = candidate.name("port").or_else(|| candidate.name("fport"))
        && port.as_str()[1..].parse::<u32>().ok()? > 65535
    {
        return None;
    }

    let mut end = matched.end();

    // A numeric port can end before adjacent Japanese prose. Keep rejecting
    // truncated ASCII ports (3000abc, 123456) and invalid hosts.
    if !valid_terminator(text, &candidate, end, explicit) {
        return None;
    }

    if !email {
        end = path_end(text, end);
    }
    *occupied = end;

    let raw = &text[start..end];
    let prefix = if email && candidate.name("mail").is_none() {
        "mailto:"
    } else if candidate.name("fuzzy").is_some() {
        "http://"
    } else {
        ""
    };

    let target = format!("{prefix}{raw}");
    let normalized_label = label(&target);

    Some(Match {
        start,
        end,
        destination: normalize(&target)?,
        label: normalized_label
            .strip_prefix(prefix)
            .unwrap_or(&normalized_label)
            .into(),
    })
}

fn valid_terminator(
    text: &str,
    candidate: &regex::Captures<'_>,
    end: usize,
    explicit: bool,
) -> bool {
    static TERMINATOR: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"^(?:[\p{P}\p{Z}\p{C}<>｜]|$)").unwrap());

    let prose_after_port = explicit
        && candidate.name("port").is_some()
        && text[end..].chars().next().is_some_and(|c| !c.is_ascii());

    if !TERMINATOR.is_match(&text[end..]) && !prose_after_port {
        return false;
    }

    if let Some(tail) = text[end..].strip_prefix('.')
        && (tail.starts_with('-') || !TERMINATOR.is_match(tail))
    {
        return false;
    }

    !text[end..].starts_with(['-', '_'])
}
