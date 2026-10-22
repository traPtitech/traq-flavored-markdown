use super::path::path_end;
use markdown_commonmark::inlines::url::{encode, label};
use regex::Regex;
use std::sync::LazyLock;

pub(super) struct Recognizer {
    tld: Regex,
    candidate: Regex,
}
impl Recognizer {
    pub fn new(tld_pattern: &str) -> Result<Self, regex::Error> {
        Ok(Self {
            tld: Regex::new(&format!("(?i)^{tld_pattern}$"))?,
            candidate: candidates(tld_pattern)?,
        })
    }
}

pub(crate) struct Match {
    pub start: usize,
    pub end: usize,
    pub destination: String,
    pub label: String,
}

impl Recognizer {
    pub fn find(&self, text: &str) -> Vec<Match> {
        let mut occupied = 0;
        self.candidate
            .captures_iter(text)
            .filter_map(|candidate| self.match_candidate(text, candidate, &mut occupied, 0))
            .collect()
    }
}

pub(super) fn scan_len(tail: &str) -> usize {
    tail.find(|ch: char| ch.is_whitespace() || ch.is_control())
        .unwrap_or(tail.len())
}

impl Recognizer {
    pub fn at(&self, text: &str, position: usize, scan_len: usize) -> Option<Match> {
        let candidate = self
            .candidate
            .captures(&text[position..position + scan_len])?;
        if candidate.get(0)?.start() != 0 {
            return None;
        }
        let mut occupied = position;
        self.match_candidate(text, candidate, &mut occupied, position)
    }
}

fn candidates(tld: &str) -> Result<Regex, regex::Error> {
    let letter = r"[^\p{P}\p{Z}\p{C}<>｜]";

    // Check the 63-character domain limit below; bounded Unicode repetitions
    // unnecessarily inflate the regex automaton in Wasm.
    let domain = format!(r"{letter}(?:(?:{letter}|-)*{letter})?");
    let host = format!(r"{domain}(?:\.{domain})*");

    // Reject invalid TLDs during matching, so a failed fuzzy host cannot
    // consume an explicit scheme later in the same run of text.
    let authority =
        format!(r"//(?:[^\s@/\[\]()<>]{{1,50}}@)?(?P<host>{host})(?P<port>:[0-9]{{1,5}})?");
    Regex::new(&format!(
        r#"(?i)(?:(?P<scheme>https?:|ftp:)?{authority}|(?P<mail>mailto:)?(?P<email>[-;:&=+$,.a-z0-9_][-;:&=+$,".a-z0-9_]{{0,63}}@{host})|(?P<fuzzy>{domain}(?:\.{domain})*\.{tld})(?P<fport>:[0-9]{{1,5}})?)"#
    ))
}

impl Recognizer {
    fn match_candidate(
        &self,
        text: &str,
        candidate: regex::Captures<'_>,
        occupied: &mut usize,
        offset: usize,
    ) -> Option<Match> {
        let matched = candidate.get(0)?;
        let start = offset + matched.start();

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
            && !self.tld.is_match(host.rsplit('.').next()?)
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

        let mut end = offset + matched.end();

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
            destination: encode(&target),
            label: normalized_label
                .strip_prefix(prefix)
                .unwrap_or(&normalized_label)
                .into(),
        })
    }
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
