use super::BlockMath;
use markdown_parser::ParseError;
use markdown_parser::rules::Budget;
use markdown_parser::rules::block::BlockInput;
use markdown_parser::rules::block::BlockMatch;
use markdown_parser::rules::block::LineIndex;

pub(super) fn opening(line: &str) -> Option<usize> {
    let text = line.trim_start_matches(' ');
    let indent = line.len() - text.len();
    (indent <= 3 && text.starts_with("$$")).then_some(indent + 2)
}

fn closing(line: &str) -> Option<&str> {
    line.trim_end().strip_suffix("$$")
}

pub(super) fn parse(
    input: &BlockInput<'_>,
    _: &mut Budget,
) -> Result<Option<BlockMatch>, ParseError> {
    let Some(offset) = opening(input.current()) else {
        return Ok(None);
    };
    let rest = &input.current()[offset..];

    let source = input.source;
    let lines = input.lines;
    let first = input.start;

    let (end, tex) = if let Some(inner) = closing(rest) {
        let start = lines[first].start + offset;
        (
            first + 1,
            source.literal(start..start + inner.len()).into_owned(),
        )
    } else {
        multiline_tex(input, rest, offset)
    };

    Ok(Some(input.leaf(
        end,
        markdown_parser::AnyPayload::new(BlockMath { tex }),
    )?))
}

fn multiline_tex(input: &BlockInput<'_>, first_line: &str, offset: usize) -> (LineIndex, String) {
    let source = input.source;
    let lines = input.lines;
    let first = input.start;
    let start = lines[first].start + offset;
    let mut end = first + 1;
    let mut tex = source.literal(start..start + first_line.len()).into_owned();
    tex.push('\n');

    while end < lines.end() {
        let next = input.line(end);
        let start = lines[end].start;
        end += 1;
        if let Some(inner) = closing(next) {
            tex.push_str(&source.literal(start..start + inner.len()));
            break;
        }
        tex.push_str(&source.literal(start..start + next.len()));
        tex.push('\n');
    }

    (end, tex)
}
