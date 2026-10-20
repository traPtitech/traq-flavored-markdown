use super::Interrupt;
use super::markers::*;
use crate::references;
use markdown_parser::engine::block::LineIndex;

use markdown_parser::{
    ParseError,
    engine::{
        Budget,
        block::{BlockInput, BlockMatch},
    },
};

struct DefinitionMatch {
    end: LineIndex,
    value: references::ParsedDefinition,
}

pub(super) fn parse(
    input: &BlockInput<'_>,
    budget: &mut Budget,
) -> Result<Option<BlockMatch>, ParseError> {
    let line = input.current();

    if line.starts_with("    ") || !line.trim_start_matches([' ', '\t']).starts_with('[') {
        return Ok(None);
    }

    let lines = input.lines;

    let Some(DefinitionMatch {
        mut end,
        value: references::ParsedDefinition {
            key, target, title, ..
        },
    }) = find_definition(input, budget)?
    else {
        return Ok(None);
    };

    if end < lines.end() && blank(input.line(end)) {
        end += 1;
    }

    Ok(Some(BlockMatch::ignore(end).on_accept(move |state, _| {
        state
            .get_or_default::<references::ReferenceMap>()
            .0
            .entry(key)
            .or_insert((target, title));
        Ok(())
    })))
}

fn find_definition(
    input: &BlockInput<'_>,
    budget: &mut Budget,
) -> Result<Option<DefinitionMatch>, ParseError> {
    let first = input.start;
    let start = input.lines[first].start;
    let text = &input.source.text()[start..];
    let Some(mut value) = references::definition(text, budget)? else {
        return Ok(None);
    };
    let line_count = |end: usize| {
        let consumed = &text[..end];
        consumed.bytes().filter(|byte| *byte == b'\n').count()
            + usize::from(!consumed.ends_with('\n'))
    };
    let mut end = first + line_count(value.end);
    // Only inspect the lines actually used by this candidate. A block interrupt
    // can truncate a multiline title, requiring at most one shorter parse.
    for line in input.lines.indices(first + 1..end) {
        budget.spend(1)?;
        if input.interrupts(line, Interrupt::Reference) {
            let boundary = input.lines[line].start - start;
            let Some(shorter) = references::definition(&text[..boundary], budget)? else {
                return Ok(None);
            };
            value = shorter;
            end = first + line_count(value.end);
            break;
        }
    }
    // Restore authored tabs only within the accepted prefix, never by copying
    // an ever-growing candidate or the remainder of the document.
    let literal = input.source.literal(start..input.lines[end - 1].end);
    if let std::borrow::Cow::Owned(literal) = literal {
        let Some(restored) = references::definition(&literal, budget)? else {
            return Ok(None);
        };
        value = restored;
    }
    Ok(Some(DefinitionMatch { end, value }))
}
