use super::{Alignment, CellData, RowData, TableData, cells};

use markdown_parser::{
    ParseError,
    engine::{
        Budget,
        block::{BlockInput, BlockMatch, DraftContent, DraftNode, Interrupt},
    },
};

pub(super) fn parse(
    input: &BlockInput<'_>,
    budget: &mut Budget,
) -> Result<Option<BlockMatch>, ParseError> {
    let first = input.start;

    let Some(align) = (first + 1 < input.lines.len())
        .then(|| cells::alignment(input.current(), input.line(first + 1)))
        .flatten()
    else {
        return Ok(None);
    };

    let mut children = vec![row(input, first, &align, true, budget)?];
    let mut end = first + 2;

    while end < input.lines.len()
        && !input.interrupts(end, Interrupt::BlockBody)
        && !input.line(end).starts_with("    ")
    {
        children.push(row(input, end, &align, false, budget)?);
        end += 1;
    }

    Ok(Some(input.matched(
        end,
        markdown_parser::NodeKind::new(TableData {}),
        DraftContent::Nodes(children),
    )?))
}

fn row(
    input: &BlockInput<'_>,
    index: usize,
    align: &[Option<Alignment>],
    header: bool,
    budget: &mut Budget,
) -> Result<DraftNode, ParseError> {
    let source = input.source;
    let line = &input.lines[index];
    let columns = cells::cells(input.line(index), line.start);

    let mut children = vec![];

    budget.token()?;
    for (column, alignment) in align.iter().enumerate() {
        budget.token()?;
        let range = columns.get(column).cloned().unwrap_or(line.end..line.end);
        children.push(cell(input, range, *alignment)?);
    }

    Ok(DraftNode::nodes(
        source.span_for(line.start..line.end)?,
        markdown_parser::NodeKind::new(RowData { header }),
        children,
    ))
}

fn cell(
    input: &BlockInput<'_>,
    range: std::ops::Range<usize>,
    alignment: Option<Alignment>,
) -> Result<DraftNode, ParseError> {
    let source = input.source;
    let raw = &source.text()[range.clone()];
    let start = range.start + raw.len() - raw.trim_start().len();
    let end = (range.start + raw.trim_end().len()).max(start);
    let pieces = split_escaped_pipes(source.text(), start, end);

    Ok(DraftNode::inline(
        source.span_for(start..end)?,
        markdown_parser::NodeKind::new(CellData { alignment }),
        source.join(&pieces)?,
    ))
}

fn split_escaped_pipes(text: &str, start: usize, end: usize) -> Vec<std::ops::Range<usize>> {
    let mut pieces = vec![];
    let mut begin = start;

    for pos in start..end {
        if text.as_bytes()[pos] == b'|' && pos > start && text.as_bytes()[pos - 1] == b'\\' {
            pieces.push(begin..pos - 1);
            begin = pos;
        }
    }

    pieces.push(begin..end);
    pieces
}
