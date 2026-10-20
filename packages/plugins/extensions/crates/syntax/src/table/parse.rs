use super::{Alignment, Cell, HeaderRow, Row, Table, cells};
use markdown_commonmark::blocks::Interrupt;
use markdown_parser::engine::block::LineIndex;

use markdown_parser::{
    ParseError,
    engine::{
        Budget,
        block::{BlockInput, BlockMatch, DraftContent, DraftNode},
    },
};

pub(super) fn parse(
    input: &BlockInput<'_>,
    budget: &mut Budget,
) -> Result<Option<BlockMatch>, ParseError> {
    let first = input.start;

    let Some(align) = (first + 1 < input.lines.end())
        .then(|| cells::alignment(input.current(), input.line(first + 1)))
        .flatten()
    else {
        return Ok(None);
    };

    let mut children = vec![row(input, first, &align, true, budget)?];
    let mut end = first + 2;

    while end < input.lines.end()
        && !input.interrupts(end, Interrupt::BlockBody)
        && !input.line(end).starts_with("    ")
    {
        children.push(row(input, end, &align, false, budget)?);
        end += 1;
    }

    Ok(Some(input.matched(
        end,
        markdown_parser::NodeKind::new(Table { alignments: align }),
        DraftContent::Nodes(children),
    )?))
}

fn row(
    input: &BlockInput<'_>,
    index: LineIndex,
    align: &[Option<Alignment>],
    header: bool,
    budget: &mut Budget,
) -> Result<DraftNode, ParseError> {
    let source = input.source;
    let line = &input.lines[index];
    let columns = cells::cells(input.line(index), line.start);

    let mut children = vec![];

    budget.token()?;
    for column in 0..align.len() {
        budget.token()?;
        let range = columns.get(column).cloned().unwrap_or(line.end..line.end);
        children.push(cell(input, range)?);
    }

    Ok(DraftNode::nodes(
        source.span_for(line.start..line.end)?,
        if header {
            markdown_parser::NodeKind::new(HeaderRow {})
        } else {
            markdown_parser::NodeKind::new(Row {})
        },
        children,
    ))
}

fn cell(input: &BlockInput<'_>, range: std::ops::Range<usize>) -> Result<DraftNode, ParseError> {
    let source = input.source;
    let raw = &source.text()[range.clone()];
    let start = range.start + raw.len() - raw.trim_start().len();
    let end = (range.start + raw.trim_end().len()).max(start);
    let pieces = split_escaped_pipes(source.text(), start, end);

    Ok(DraftNode::inline(
        source.span_for(start..end)?,
        markdown_parser::NodeKind::new(Cell {}),
        source.join(&pieces)?,
    ))
}

fn split_escaped_pipes(text: &str, start: usize, end: usize) -> Vec<std::ops::Range<usize>> {
    let mut pieces = vec![];
    let mut begin = start;

    for pos in start..end {
        if text.as_bytes()[pos] == b'|' && cells::escaped_pipe(text, pos) {
            pieces.push(begin..pos - 1);
            begin = pos;
        }
    }

    pieces.push(begin..end);
    pieces
}
