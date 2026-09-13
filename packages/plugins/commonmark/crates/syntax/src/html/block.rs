use super::tags;

use markdown_parser::{
    NodeKind, ParseError,
    engine::{
        Budget,
        block::{BlockInput, BlockMatch, DraftNode},
    },
};

use regex::Regex;
use std::sync::LazyLock;

pub(super) fn start(line: &str) -> Option<u8> {
    let text = line.trim_start_matches(' ');

    if line.len() - text.len() > 3 || !text.starts_with('<') {
        return None;
    }

    static RAW: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"(?i)^<(?:script|pre|style|textarea)(?:[ \t]|>|$)").unwrap());

    static BLOCK: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(concat!(
            r"(?i)^</?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|",
            r"h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:[ \t]|/?>|$)"
        )).unwrap()
    });

    if RAW.is_match(text) {
        Some(1)
    } else if text.starts_with("<!--") {
        Some(2)
    } else if text.starts_with("<?") {
        Some(3)
    } else if text.starts_with("<!") && text.as_bytes().get(2).is_some_and(u8::is_ascii_uppercase) {
        Some(4)
    } else if text.starts_with("<![CDATA[") {
        Some(5)
    } else if BLOCK.is_match(text) {
        Some(6)
    } else if tags::complete_tag(text) {
        Some(7)
    } else {
        None
    }
}

fn closes(kind: u8, line: &str) -> bool {
    match kind {
        1 => {
            static END: LazyLock<Regex> =
                LazyLock::new(|| Regex::new(r"(?i)</(?:script|pre|style|textarea)>").unwrap());
            END.is_match(line)
        }

        2 => line.contains("-->"),
        3 => line.contains("?>"),
        4 => line.contains('>'),
        5 => line.contains("]]>"),
        _ => line.bytes().all(|b| matches!(b, b' ' | b'\t')),
    }
}

pub(super) fn parse(
    input: &BlockInput<'_>,
    budget: &mut Budget,
) -> Result<Option<BlockMatch>, ParseError> {
    let Some(kind) = start(input.current()) else {
        return Ok(None);
    };

    let end = block_end(input, kind, budget)?;
    let range = input.lines[input.start].start..input.lines[end - 1].end;
    let literal = input.source.literal(range.clone()).into_owned();
    let span = input.source.span_for(range.start..range.end)?;

    Ok(Some(BlockMatch::node(
        end,
        DraftNode::leaf(
            span,
            NodeKind::new(markdown_commonmark_contracts::HtmlBlock { literal }),
        ),
    )))
}

fn block_end(input: &BlockInput<'_>, kind: u8, budget: &mut Budget) -> Result<usize, ParseError> {
    let mut end = input.start + 1;

    if !closes(kind, input.current()) {
        while end < input.lines.len() {
            let line = input.line(end);
            budget.spend(line.len())?;

            if closes(kind, line) {
                if kind < 6 {
                    end += 1;
                }
                break;
            }

            end += 1;
        }
    }

    Ok(end)
}
