use super::BlockMathData;
use markdown_parser::{
    ParseError,
    engine::{
        Budget,
        block::{BlockInput, BlockMatch},
    },
};

pub(super) fn parse(
    input: &BlockInput<'_>,
    _: &mut Budget,
) -> Result<Option<BlockMatch>, ParseError> {
    let Some(rest) = input.current().strip_prefix("$$") else {
        return Ok(None);
    };

    let source = input.source;
    let lines = input.lines;
    let first = input.start;

    let (end, tex) = if let Some(inner) = rest.strip_suffix("$$") {
        let start = lines[first].start + 2;
        (
            first + 1,
            source.literal(start..start + inner.len()).into_owned(),
        )
    } else {
        multiline_tex(input, rest)
    };

    Ok(Some(input.leaf(
        end,
        markdown_parser::NodeKind::new(BlockMathData { tex }),
    )?))
}

fn multiline_tex(input: &BlockInput<'_>, first_line: &str) -> (usize, String) {
    let source = input.source;
    let lines = input.lines;
    let first = input.start;
    let start = lines[first].start + 2;
    let mut end = first + 1;
    let mut tex = source.literal(start..start + first_line.len()).into_owned();
    tex.push('\n');

    while end < lines.len() {
        let next = input.line(end);
        let start = lines[end].start;
        end += 1;
        if let Some(inner) = next.trim_end().strip_suffix("$$") {
            tex.push_str(&source.literal(start..start + inner.len()));
            break;
        }
        tex.push_str(&source.literal(start..start + next.len()));
        tex.push('\n');
    }

    (end, tex)
}
