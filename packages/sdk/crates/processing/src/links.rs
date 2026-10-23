//! traQ URL meaning, independent of Markdown nodes and output formats.
//! Exact lexical matching shared with TypeScript through traq-links.json.
use markdown_trap_contracts::ReferenceId;

const MAX_ORIGIN_BYTES: usize = 2048;

pub(crate) fn validate_origin(origin: &str) -> crate::Result<()> {
    if origin.len() > MAX_ORIGIN_BYTES {
        Err(crate::Error::ResourceLimit {
            resource: "origin_bytes",
            limit: MAX_ORIGIN_BYTES,
        })
    } else {
        Ok(())
    }
}

#[derive(Debug, PartialEq)]
pub enum Target {
    File { id: String },
    Message { id: String },
}

/// Classifies absolute traQ resource URLs using an exact configured prefix.
/// This is a lexical classifier, not a URL resolver: relative URLs are never
/// joined to a base URL. An empty origin explicitly disables classification.
pub struct TraqUrlClassifier {
    origin: Option<String>,
}

impl TraqUrlClassifier {
    pub fn new(origin: &str) -> Self {
        let origin = origin.trim_end_matches('/');
        Self {
            origin: (!origin.is_empty()).then(|| origin.into()),
        }
    }

    pub fn classify(&self, url: &str) -> Option<Target> {
        let origin = self.origin.as_deref()?;
        let path = url.strip_prefix(origin)?.split(['?', '#']).next()?;
        if let Some(id) = path
            .strip_prefix("/files/")
            .filter(|id| ReferenceId::is_hyphenated(id))
        {
            Some(Target::File {
                id: id.to_ascii_lowercase(),
            })
        } else {
            let id = path
                .strip_prefix("/messages/")
                .filter(|id| ReferenceId::is_hyphenated(id))?;
            Some(Target::Message {
                id: id.to_ascii_lowercase(),
            })
        }
    }
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
            let target = match TraqUrlClassifier::new(&fixture.origin).classify(&fixture.url) {
                Some(Target::File { id }) => serde_json::json!({"type": "file", "id": id}),
                Some(Target::Message { id }) => serde_json::json!({"type": "message", "id": id}),
                None => serde_json::Value::Null,
            };
            assert_eq!(target, fixture.target, "{}", fixture.name);
        }
    }
}
