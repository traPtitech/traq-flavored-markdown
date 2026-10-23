use super::Interrupt;
use super::{markers::*, paragraph::paragraph_start};

use markdown_parser::AnyPayload;
use markdown_parser::ParseError;
use markdown_parser::rules::Budget;
use markdown_parser::rules::block::BlockInput;
use markdown_parser::rules::block::BlockMatch;
use markdown_parser::rules::block::DraftNode;

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

    while end < lines.end() {
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
            AnyPayload::new(markdown_commonmark_contracts::Blockquote {}),
            view,
        ),
    )))
}
