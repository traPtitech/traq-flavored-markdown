//! traQ URL meaning, independent of Markdown nodes and output formats.
//! Exact lexical matching shared with TypeScript through traq-links.json.

#[derive(Debug, PartialEq)]
pub enum Target {
    File { id: String },
    Message { id: String },
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

    pub fn classify(&self, url: &str) -> Option<Target> {
        if self.origin.is_empty() {
            return None;
        }
        let path = url.strip_prefix(&self.origin)?.split(['?', '#']).next()?;
        if let Some(id) = path
            .strip_prefix("/files/")
            .filter(|id| is_hyphenated_uuid(id))
        {
            Some(Target::File {
                id: id.to_ascii_lowercase(),
            })
        } else {
            let id = path
                .strip_prefix("/messages/")
                .filter(|id| is_hyphenated_uuid(id))?;
            Some(Target::Message {
                id: id.to_ascii_lowercase(),
            })
        }
    }
}

fn is_hyphenated_uuid(value: &str) -> bool {
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

    #[test]
    fn shared_url_contract() {
        #[derive(serde::Deserialize)]
        struct Fixture {
            name: String,
            origin: String,
            url: String,
            target: serde_json::Value,
        }
        let fixtures: Vec<Fixture> =
            serde_json::from_str(include_str!("../../../tests/fixtures/traq-links.json")).unwrap();
        for fixture in fixtures {
            let target = match Links::new(&fixture.origin).classify(&fixture.url) {
                Some(Target::File { id }) => serde_json::json!({"type": "file", "id": id}),
                Some(Target::Message { id }) => serde_json::json!({"type": "message", "id": id}),
                None => serde_json::Value::Null,
            };
            assert_eq!(target, fixture.target, "{}", fixture.name);
        }
    }
}
