use super::markers::*;
use crate::references;

use markdown_parser::{
    ParseError,
    engine::{
        Budget,
        block::{BlockInput, BlockMatch, Definition, Interrupt},
    },
};

type DefinitionValue = (String, String, Option<String>);
type DefinitionMatch = (usize, DefinitionValue);

pub(super) fn parse(
    input: &BlockInput<'_>,
    budget: &mut Budget,
    normalize: fn(&str) -> Option<String>,
) -> Result<Option<BlockMatch>, ParseError> {
    let line = input.current();

    if line.starts_with("    ") || !line.trim_start_matches([' ', '\t']).starts_with('[') {
        return Ok(None);
    }

    let lines = input.lines;

    let Some((mut end, (key, destination, title))) = find_definition(input, budget, normalize)?
    else {
        return Ok(None);
    };

    if end < lines.len() && blank(input.line(end)) {
        end += 1;
    }

    let mut result = BlockMatch::ignore(end);
    result.definitions.push(Definition {
        key,
        destination,
        title,
    });

    Ok(Some(result))
}

fn find_definition(
    input: &BlockInput<'_>,
    budget: &mut Budget,
    normalize: fn(&str) -> Option<String>,
) -> Result<Option<DefinitionMatch>, ParseError> {
    let line = input.current();
    let first = input.start;
    let lines = input.lines;

    let mut last = first + 1;
    let mut found = None;

    while last <= lines.len() {
        if last > first + 1 && input.interrupts(last - 1, Interrupt::Reference) {
            break;
        }

        let text = input
            .source
            .literal(lines[first].start..lines[last - 1].end);

        budget.spend(text.len())?;

        if let Some(definition) = references::definition(&text, budget, normalize)? {
            found = Some((last, definition));

            if last == lines.len()
                || !input
                    .line(last)
                    .trim_start_matches([' ', '\t'])
                    .starts_with(['\'', '"', '('])
            {
                break;
            }
        }

        if last == first + 1
            && references::label_end(line.trim_start_matches([' ', '\t'])).is_some()
            && !line.contains("]:")
        {
            break;
        }

        last += 1;
    }

    Ok(found)
}
