use super::markers::*;
use markdown_parser::rules::block::LineIndex;

use markdown_parser::AnyPayload;
use markdown_parser::ParseError;
use markdown_parser::rules::Budget;
use markdown_parser::rules::block::BlockInput;
use markdown_parser::rules::block::BlockMatch;
use markdown_parser::rules::block::DraftNode;

pub(super) fn fenced(
    input: &BlockInput<'_>,
    _: &mut Budget,
) -> Result<Option<BlockMatch>, ParseError> {
    let Some((marker, count, info)) = fence(input.current()) else {
        return Ok(None);
    };

    let source = input.source;
    let lines = input.lines;
    let first = input.start;

    let info_end = lines[first].start + input.current().trim_end().len();
    let info =
        super::super::inlines::entities::unescape(&source.literal(info_end - info.len()..info_end));
    let indent = input.current().len() - input.current().trim_start_matches(' ').len();

    let mut end = closing_fence(input, marker, count);
    let literal = fenced_literal(input, end, indent);

    // Include the closing fence in the node span when one was found.
    if end < lines.end() {
        end += 1;
    }

    Ok(Some(BlockMatch::node(
        end,
        DraftNode::leaf(
            source.span_for(lines[first].start..lines[end - 1].end)?,
            AnyPayload::new(markdown_commonmark_contracts::CodeBlock {
                fenced: true,
                info,
                literal,
            }),
        ),
    )))
}

fn closing_fence(input: &BlockInput<'_>, marker: u8, count: usize) -> LineIndex {
    let mut end = input.start + 1;

    while end < input.lines.end() {
        if fence(input.line(end))
            .is_some_and(|(m, n, info)| m == marker && n >= count && info.is_empty())
        {
            break;
        }
        end += 1;
    }

    end
}

fn fenced_literal(input: &BlockInput<'_>, end: LineIndex, indent: usize) -> String {
    let source = input.source;

    input.lines[input.start + 1..end]
        .iter()
        .map(|line| {
            let raw = &source[line.clone()];
            let remove = indent.min(raw.len() - raw.trim_start_matches(' ').len());
            source.literal(line.start + remove..line.end)
        })
        .collect()
}

pub(super) fn indented(
    input: &BlockInput<'_>,
    _: &mut Budget,
) -> Result<Option<BlockMatch>, ParseError> {
    if !input.current().starts_with("    ") {
        return Ok(None);
    }

    let (end, literal) = indented_content(input);
    let source = input.source;
    let lines = input.lines;
    let first = input.start;

    Ok(Some(BlockMatch::node(
        end,
        DraftNode::leaf(
            source.span_for(lines[first].start..lines[end - 1].end)?,
            AnyPayload::new(markdown_commonmark_contracts::CodeBlock {
                fenced: false,
                info: String::new(),
                literal,
            }),
        ),
    )))
}

fn indented_content(input: &BlockInput<'_>) -> (LineIndex, String) {
    let source = input.source;
    let lines = input.lines;

    let mut end = input.start;
    let mut literal = String::new();

    // A blank line belongs to an indented block only when another indented
    // line follows it.
    while end < lines.end() {
        let raw = &source[lines[end].clone()];

        if blank(input.line(end)) {
            let next = lines
                .indices(end + 1..lines.end())
                .find(|i| !blank(input.line(*i)));

            if next.is_some_and(|i| input.line(i).starts_with("    ")) {
                let remove = 4.min(raw.len() - raw.trim_start_matches(' ').len());
                literal.push_str(&source.literal(lines[end].start + remove..lines[end].end));
                end += 1;
                continue;
            }
            break;
        }

        if raw.starts_with("    ") {
            literal.push_str(&source.literal(lines[end].start + 4..lines[end].end));
            end += 1;
        } else {
            break;
        }
    }

    if !literal.ends_with('\n') {
        literal.push('\n');
    }
    (end, literal)
}

pub(super) fn atx(
    input: &BlockInput<'_>,
    _: &mut Budget,
) -> Result<Option<BlockMatch>, ParseError> {
    let Some((level, prefix)) = heading(input.current()) else {
        return Ok(None);
    };

    let source = input.source;
    let line = &input.lines[input.start];

    let mut end = line.start
        + input
            .current()
            .trim_end_matches(ascii_space)
            .len()
            .max(prefix);

    let text = &source[line.start + prefix..end];
    let without = text.trim_end_matches('#');

    if without.is_empty() || without.ends_with([' ', '\t']) {
        end = line.start + prefix + without.trim_end_matches(ascii_space).len();
    }

    let view = source.join(&[line.start + prefix..end])?;

    Ok(Some(BlockMatch::node(
        input.start + 1,
        DraftNode::inline(
            source.span_for(line.start..line.end)?,
            AnyPayload::new(markdown_commonmark_contracts::Heading { level }),
            view,
        ),
    )))
}

pub(super) fn thematic_break(
    input: &BlockInput<'_>,
    _: &mut Budget,
) -> Result<Option<BlockMatch>, ParseError> {
    if !thematic(input.current()) {
        return Ok(None);
    }

    let line = &input.lines[input.start];
    let marker = input
        .current()
        .chars()
        .filter(|ch| !ch.is_ascii_whitespace())
        .collect();

    Ok(Some(BlockMatch::node(
        input.start + 1,
        DraftNode::leaf(
            input.source.span_for(line.start..line.end)?,
            AnyPayload::new(markdown_commonmark_contracts::ThematicBreak { marker }),
        ),
    )))
}
