//! Apply source replacements independently of AST traversal order.
use markdown_ast::Span;

/// Earlier outer ranges win over contained edits, including duplicate ranges.
/// Crossing ranges cannot describe one source edit and are rejected.
pub(crate) fn apply(source: &str, mut edits: Vec<(Span, &str)>) -> Result<String, &'static str> {
    edits.sort_by_key(|(span, _)| (span.start, std::cmp::Reverse(span.end)));
    edits.dedup_by_key(|(span, _)| *span);
    let mut output = String::new();
    let mut position = 0;

    for (span, replacement) in edits {
        if source.get(span.start..span.end).is_none() {
            return Err("invalid_edit");
        }
        if span.start < position {
            if span.end > position {
                return Err("overlapping_edits");
            }
            continue;
        }
        output.push_str(&source[position..span.start]);
        output.push_str(replacement);
        position = span.end;
    }
    output.push_str(&source[position..]);
    Ok(output)
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
            Err("overlapping_edits")
        );
        for (start, end) in [(1, 3), (3, 1), (0, 4)] {
            assert_eq!(
                apply("あ", vec![edit(start, end, "x")]),
                Err("invalid_edit")
            );
        }
    }
}
