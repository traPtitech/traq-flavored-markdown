use crate::Span;

/// Original UTF-8 source addressed exclusively by byte offsets.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SourceText<'a>(&'a str);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SourceEdit<'a> {
    pub span: Span,
    pub text: &'a str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SourceError {
    InvalidSpan {
        span: Span,
    },
    OverlappingEdits {
        span: Span,
        previous_end: usize,
    },
    ResourceLimit {
        resource: &'static str,
        limit: usize,
    },
}

impl<'a> SourceText<'a> {
    pub fn new(source: &'a str) -> Self {
        Self(source)
    }
    pub fn as_str(self) -> &'a str {
        self.0
    }
    pub fn byte_len(self) -> usize {
        self.0.len()
    }
    pub fn is_boundary(self, offset: usize) -> bool {
        self.0.is_char_boundary(offset)
    }

    pub fn slice(self, span: Span) -> Result<&'a str, SourceError> {
        self.0
            .get(span.start..span.end)
            .ok_or(SourceError::InvalidSpan { span })
    }

    /// Apply ordered, disjoint replacements without changing untouched bytes.
    pub fn replace(self, edits: &[SourceEdit<'_>]) -> Result<String, SourceError> {
        self.replace_with_limit(edits, usize::MAX)
    }

    /// Preflight every range and output byte count before allocating the result.
    pub fn replace_with_limit(
        self,
        edits: &[SourceEdit<'_>],
        limit: usize,
    ) -> Result<String, SourceError> {
        let resource = || SourceError::ResourceLimit {
            resource: "output_bytes",
            limit,
        };
        let mut position = 0;
        let mut length = 0usize;
        for edit in edits {
            self.slice(edit.span)?;
            if edit.span.start < position {
                return Err(SourceError::OverlappingEdits {
                    span: edit.span,
                    previous_end: position,
                });
            }
            length = length
                .checked_add(edit.span.start - position)
                .and_then(|length| length.checked_add(edit.text.len()))
                .filter(|length| *length <= limit)
                .ok_or_else(resource)?;
            position = edit.span.end;
        }
        length = length
            .checked_add(self.byte_len() - position)
            .filter(|length| *length <= limit)
            .ok_or_else(resource)?;
        let mut output = String::new();
        output.try_reserve_exact(length).map_err(|_| resource())?;
        position = 0;
        for edit in edits {
            output.push_str(&self.0[position..edit.span.start]);
            output.push_str(edit.text);
            position = edit.span.end;
        }
        output.push_str(&self.0[position..]);
        Ok(output)
    }
}

impl std::fmt::Display for SourceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidSpan { span } => {
                write!(f, "invalid source span {}..{}", span.start, span.end)
            }
            Self::OverlappingEdits { span, previous_end } => write!(
                f,
                "source edit {}..{} precedes previous end {previous_end}",
                span.start, span.end
            ),
            Self::ResourceLimit { resource, limit } => write!(f, "{resource} limit: {limit}"),
        }
    }
}
impl std::error::Error for SourceError {}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Fixture {
        name: String,
        source: String,
        slices: Vec<Edit>,
        invalid_spans: Vec<Range>,
        edits: Vec<Edit>,
        expected: String,
    }
    #[derive(Deserialize)]
    struct Range {
        start: usize,
        end: usize,
    }
    impl Range {
        fn span(&self) -> Span {
            Span {
                start: self.start,
                end: self.end,
            }
        }
    }
    #[derive(Deserialize)]
    struct Edit {
        start: usize,
        end: usize,
        text: String,
    }
    impl Edit {
        fn span(&self) -> Span {
            Span {
                start: self.start,
                end: self.end,
            }
        }
    }

    #[test]
    fn shared_source_byte_fixtures() {
        let fixtures: Vec<Fixture> = serde_json::from_str(include_str!(
            "../../../../../tests/fixtures/source-spans.json"
        ))
        .unwrap();
        for fixture in fixtures {
            let source = SourceText::new(&fixture.source);
            assert_eq!(source.as_str(), fixture.source);
            assert_eq!(source.byte_len(), fixture.source.len());
            for slice in fixture.slices {
                assert_eq!(
                    source.slice(slice.span()).unwrap(),
                    slice.text,
                    "{}",
                    fixture.name
                );
            }
            for span in fixture.invalid_spans {
                assert!(source.slice(span.span()).is_err(), "{}", fixture.name);
            }
            let edits: Vec<_> = fixture
                .edits
                .iter()
                .map(|edit| SourceEdit {
                    span: edit.span(),
                    text: &edit.text,
                })
                .collect();
            assert_eq!(
                source.replace(&edits).unwrap(),
                fixture.expected,
                "{}",
                fixture.name
            );
            assert_eq!(
                source
                    .replace_with_limit(&edits, fixture.expected.len())
                    .unwrap(),
                fixture.expected
            );
            assert!(
                source
                    .replace_with_limit(&edits, fixture.expected.len() - 1)
                    .is_err()
            );
        }
    }

    #[test]
    fn edits_are_validated_before_output_and_must_be_disjoint() {
        let source = SourceText::new("éab");
        assert!(!source.is_boundary(1));
        assert!(!source.is_boundary(5));
        assert!(source.is_boundary(4));
        let first = SourceEdit {
            span: Span { start: 0, end: 3 },
            text: "x",
        };
        let crossing = SourceEdit {
            span: Span { start: 2, end: 4 },
            text: "y",
        };
        assert_eq!(
            source.replace(&[first, crossing]),
            Err(SourceError::OverlappingEdits {
                span: crossing.span,
                previous_end: 3
            })
        );
        let invalid = SourceEdit {
            span: Span { start: 1, end: 2 },
            text: "y",
        };
        assert_eq!(
            source.replace(&[first, invalid]),
            Err(SourceError::InvalidSpan { span: invalid.span })
        );
        assert!(matches!(
            source.replace_with_limit(&[], 3),
            Err(SourceError::ResourceLimit {
                resource: "output_bytes",
                limit: 3
            })
        ));
        // A removed suffix does not count toward the bounded output.
        assert_eq!(
            source
                .replace_with_limit(
                    &[
                        SourceEdit {
                            span: Span { start: 0, end: 2 },
                            text: "abc"
                        },
                        SourceEdit {
                            span: Span { start: 2, end: 4 },
                            text: ""
                        }
                    ],
                    3
                )
                .unwrap(),
            "abc"
        );
    }
}
