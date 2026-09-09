//! traQ URL meaning, independent of Markdown nodes and output formats.
//! Matching preserves the notification prototype's existing lexical policy.

#[derive(Debug, PartialEq)]
pub enum Target<'a> {
    File { id: &'a str },
    Message { id: &'a str },
}

pub struct Links {
    origin: String,
}

impl Links {
    pub fn new(origin: &str) -> Self {
        Self {
            origin: origin.trim_end_matches('/').into(),
        }
    }

    pub fn classify<'a>(&self, url: &'a str) -> Option<Target<'a>> {
        if self.origin.is_empty() {
            return None;
        }
        let path = url.strip_prefix(&self.origin)?.split(['?', '#']).next()?;
        if let Some(id) = path.strip_prefix("/files/").filter(|id| is_canonical(id)) {
            Some(Target::File { id })
        } else {
            let id = path
                .strip_prefix("/messages/")
                .filter(|id| is_canonical(id))?;
            Some(Target::Message { id })
        }
    }
}

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

#[cfg(test)]
mod tests {
    use super::*;
    const ID: &str = "00000000-0000-0000-0000-000000000001";

    #[test]
    fn classification_checks_origin_path_and_id_boundaries() {
        let links = Links::new("https://q.example.test/");
        for suffix in ["", "?download=1", "#part", "?download=1#part"] {
            assert_eq!(
                links.classify(&format!("https://q.example.test/files/{ID}{suffix}")),
                Some(Target::File { id: ID })
            );
        }
        for url in [
            format!("https://q.example.test.evil/files/{ID}"),
            format!("https://q.example.test@evil/files/{ID}"),
            format!("http://q.example.test/files/{ID}"),
            format!("https://other.example.test/files/{ID}"),
            format!("https://q.example.test/files/{ID}/extra"),
            format!("https://q.example.test/files/{ID}/"),
            format!("https://q.example.test/files/{ID}a"),
            format!("https://q.example.test/prefix/files/{ID}"),
            format!("/files/{ID}"),
            "https://q.example.test/files/not-a-uuid".into(),
        ] {
            assert_eq!(links.classify(&url), None, "{url}");
        }
        assert_eq!(
            Links::new("").classify(&format!("https://q.example.test/files/{ID}")),
            None
        );
    }
}
