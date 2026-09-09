use super::{markers::*, paragraph::paragraph_start};

use markdown_parser::{
    NodeKind, ParseError,
    engine::{
        Budget,
        block::{BlockInput, BlockMatch, DraftNode, Interrupt},
    },
};

pub fn parse(
    input: &BlockInput<'_>,
    budget: &mut Budget,
) -> Result<Option<BlockMatch>, ParseError> {
    if quote(input.current()).is_none() {
        return Ok(None);
    }

    let source = input.source;
    let lines = input.lines;
    let first = input.start;

    let mut end = first;
    let mut ranges = vec![];
    let mut lazy_lines = vec![];
    let mut lazy = false;

    while end < lines.len() {
        let next = input.line(end);
        let indent = next.len() - next.trim_start_matches(' ').len();

        if let Some(prefix) = quote(&next[indent..]).map(|width| width + indent) {
            lazy = paragraph_start(&next[prefix..], input);
            ranges.push(lines[end].start + prefix..lines[end].end);
        } else if lazy && !input.interrupts(end, Interrupt::LazyContinuation) && !blank(next) {
            lazy_lines.push(source.span_for(lines[end].start..lines[end].start)?.start);
            ranges.push(lines[end].clone());
        } else {
            break;
        }

        end += 1;
    }

    let mut view = source.join(&ranges)?;
    super::super::context::mark_lazy(&mut view, lazy_lines, budget)?;

    Ok(Some(BlockMatch::node(
        end,
        DraftNode::blocks(
            source.span_for(lines[first].start..lines[end - 1].end)?,
            NodeKind::new(markdown_commonmark_contracts::Blockquote {}),
            view,
        ),
    )))
}
