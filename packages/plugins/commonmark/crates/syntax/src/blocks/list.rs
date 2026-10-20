use super::Interrupt;
use super::markers::*;
use markdown_commonmark_contracts::{BulletMarker, ListKind, OrderedDelimiter};
use markdown_parser::engine::block::LineIndex;

use markdown_parser::{
    NodeKind, ParseError,
    engine::{
        Budget,
        block::{BlockInput, BlockMatch, DraftNode, ResolvedBlock},
    },
};

use std::ops::Range;

pub(super) fn parse(
    input: &BlockInput<'_>,
    budget: &mut Budget,
) -> Result<Option<BlockMatch>, ParseError> {
    let Some(first_marker) = item(input.current()) else {
        return Ok(None);
    };

    let source = input.source;
    let lines = input.lines;
    let first = input.start;

    let mut i = first;
    let mut children = vec![];
    let mut tight = true;

    while i < lines.end() {
        if thematic(content(source, &lines[i])) {
            break;
        }

        let Some(marker) = item(content(source, &lines[i])) else {
            break;
        };

        if first_marker.ordered != marker.ordered || first_marker.delimiter != marker.delimiter {
            break;
        }

        let item_start = i;
        let first_content = &content(source, &lines[i])[marker.content..];
        let lazy = super::paragraph::paragraph_start(first_content, input);

        let end = if first_content.is_empty()
            && (i + 1 == lines.end() || blank(content(source, &lines[i + 1])))
        {
            lines[i].start + marker.content
        } else {
            lines[i].end
        };

        let mut ranges = vec![lines[i].start + marker.content..end];
        i += 1;

        let (next, item_tight) = collect_continuation(
            input,
            &first_marker,
            &marker,
            first_content,
            lazy,
            i,
            &mut ranges,
        );

        i = next;
        tight &= item_tight;

        // Blank continuation lines still lose the list's indentation,
        // including when they become literal content of a fenced block.
        unindent_blank_continuations(source, marker.width, &mut ranges);

        budget.token()?;
        children.push(DraftNode::blocks(
            source.span_for(lines[item_start].start..lines[i - 1].end)?,
            NodeKind::new(markdown_commonmark_contracts::ListItem {}),
            source.join(&ranges)?,
        ));
    }

    let mut node = DraftNode::nodes(
        source.span_for(lines[first].start..lines[i - 1].end)?,
        NodeKind::new(markdown_commonmark_contracts::List {
            kind: if first_marker.ordered {
                ListKind::Ordered {
                    start: first_marker.start,
                    delimiter: if first_marker.delimiter == b'.' {
                        OrderedDelimiter::Period
                    } else {
                        OrderedDelimiter::Parenthesis
                    },
                }
            } else {
                ListKind::Bullet {
                    marker: match first_marker.delimiter {
                        b'-' => BulletMarker::Dash,
                        b'+' => BulletMarker::Plus,
                        _ => BulletMarker::Asterisk,
                    },
                }
            },
            tight,
        }),
        children,
    );

    node.finish = Some(finish_list);

    Ok(Some(BlockMatch::node(i, node)))
}

fn collect_continuation(
    input: &BlockInput<'_>,
    first_marker: &Marker,
    marker: &Marker,
    first_content: &str,
    lazy: bool,
    mut i: LineIndex,
    ranges: &mut Vec<Range<usize>>,
) -> (LineIndex, bool) {
    let source = input.source;
    let lines = input.lines;

    let mut item_tight = true;

    while i < lines.end() {
        let continuation = content(source, &lines[i]);

        if blank(continuation) {
            let next = lines
                .indices(i + 1..lines.end())
                .find(|j| !blank(content(source, &lines[*j])));

            let Some(next) = next else {
                if !blank(first_content) {
                    ranges.extend_from_slice(&lines[i..]);
                }
                return (lines.end(), item_tight);
            };

            let next_line = content(source, &lines[next]);

            if blank(first_content) {
                item_tight = !item(next_line).is_some_and(|m| {
                    m.ordered == first_marker.ordered && m.delimiter == first_marker.delimiter
                });
                return (next, item_tight);
            }

            let next_indent = next_line.len() - next_line.trim_start_matches(' ').len();

            if next_indent >= marker.width {
                ranges.push(lines[i].clone());
                i += 1;
                continue;
            }

            if item(next_line).is_some_and(|m| {
                m.ordered == first_marker.ordered && m.delimiter == first_marker.delimiter
            }) {
                item_tight = false;
                ranges.extend_from_slice(&lines[i..next]);
            } else if !blank(first_content) {
                ranges.extend_from_slice(&lines[i..next]);
            }

            return (next, item_tight);
        }

        let indent = continuation.len() - continuation.trim_start_matches(' ').len();

        if indent >= marker.width {
            ranges.push(lines[i].start + marker.width..lines[i].end);
        } else if lazy
            && !input.interrupts_text(continuation, None, Interrupt::LazyContinuation)
            && item(continuation).is_none()
        {
            ranges.push(lines[i].clone());
        } else {
            return (i, item_tight);
        }

        i += 1;
    }

    (i, item_tight)
}

fn unindent_blank_continuations(
    source: &markdown_parser::engine::source::SourceView,
    marker_width: usize,
    ranges: &mut [Range<usize>],
) {
    for range in ranges.iter_mut().skip(1) {
        let raw = &source.text()[range.clone()];

        if blank(raw.trim_end_matches('\n')) {
            range.start += marker_width.min(raw.len() - raw.trim_start_matches(' ').len());
        }
    }
}

fn finish_list(node: &mut ResolvedBlock) {
    let loose = node.children().iter().any(|item| {
        item.metadata
            .get::<super::policy::BlockSpacing>()
            .is_some_and(|spacing| spacing.loose)
            || item
                .children()
                .iter()
                .filter(|child| {
                    child
                        .kind
                        .get::<markdown_commonmark_contracts::Paragraph>()
                        .is_some()
                })
                .count()
                > 1
    });

    if let Some(list) = node.kind.get_mut::<markdown_commonmark_contracts::List>() {
        list.tight &= !loose;
    }
}
