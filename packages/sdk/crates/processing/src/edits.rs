//! Apply source replacements independently of AST traversal order.
use markdown_ast::{SourceEdit, SourceText, Span};

/// Earlier outer ranges win over contained edits, including duplicate ranges.
/// Crossing ranges cannot describe one source edit and are rejected.
pub(crate) fn apply(source: &str, mut edits: Vec<(Span, &str)>) -> crate::Result<String> {
    edits.sort_by_key(|(span, _)| (span.start, std::cmp::Reverse(span.end)));
    edits.dedup_by_key(|(span, _)| *span);
    let source = SourceText::new(source);
    let mut selected = Vec::with_capacity(edits.len());
    let mut position = 0;

    for (span, replacement) in edits {
        source.slice(span)?;
        if span.start < position {
            if span.end > position {
                return Err(crate::Error::OverlappingEdits {
                    span,
                    previous_end: position,
                });
            }
            continue;
        }
        selected.push(SourceEdit {
            span,
            text: replacement,
        });
        position = span.end;
    }
    source.replace(&selected).map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn edits_are_ordered_bounded_and_outermost() {
        let edit = |start, end, text| (Span { start, end }, text);
        assert_eq!(
            apply("", vec![edit(0, 0, "first"), edit(0, 0, "duplicate")]),
            Ok("first".into())
        );
        assert_eq!(
            apply(
                "あいうえ",
                vec![
                    edit(6, 9, "C"),
                    edit(0, 6, "AB"),
                    edit(0, 3, "A"),
                    edit(0, 6, "duplicate")
                ]
            ),
            Ok("ABCえ".into())
        );
        assert_eq!(
            apply("abcd", vec![edit(0, 3, "x"), edit(2, 4, "y")]),
            Err(crate::Error::OverlappingEdits {
                span: Span { start: 2, end: 4 },
                previous_end: 3
            })
        );
        for (start, end) in [(1, 3), (3, 1), (0, 4)] {
            assert_eq!(
                apply("あ", vec![edit(start, end, "x")]),
                Err(crate::Error::InvalidEdit {
                    span: Span { start, end }
                })
            );
        }
    }
}
