use super::tags;
use markdown_parser::rules::block::LineIndex;

use markdown_parser::AnyPayload;
use markdown_parser::ParseError;
use markdown_parser::rules::Budget;
use markdown_parser::rules::block::BlockInput;
use markdown_parser::rules::block::BlockMatch;
use markdown_parser::rules::block::DraftNode;

use regex::Regex;
use std::sync::LazyLock;

#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum HtmlBlockKind {
    RawText,
    Comment,
    ProcessingInstruction,
    Declaration,
    Cdata,
    BlockTag,
    CompleteTag,
}
impl HtmlBlockKind {
    pub fn interrupts(self) -> bool {
        self != Self::CompleteTag
    }
    fn blank_terminated(self) -> bool {
        matches!(self, Self::BlockTag | Self::CompleteTag)
    }
}

pub(super) fn start(line: &str) -> Option<HtmlBlockKind> {
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
        Some(HtmlBlockKind::RawText)
    } else if text.starts_with("<!--") {
        Some(HtmlBlockKind::Comment)
    } else if text.starts_with("<?") {
        Some(HtmlBlockKind::ProcessingInstruction)
    } else if text.starts_with("<!") && text.as_bytes().get(2).is_some_and(u8::is_ascii_uppercase) {
        Some(HtmlBlockKind::Declaration)
    } else if text.starts_with("<![CDATA[") {
        Some(HtmlBlockKind::Cdata)
    } else if BLOCK.is_match(text) {
        Some(HtmlBlockKind::BlockTag)
    } else if tags::complete_tag(text) {
        Some(HtmlBlockKind::CompleteTag)
    } else {
        None
    }
}

fn closes(kind: HtmlBlockKind, line: &str) -> bool {
    match kind {
        HtmlBlockKind::RawText => {
            static END: LazyLock<Regex> =
                LazyLock::new(|| Regex::new(r"(?i)</(?:script|pre|style|textarea)>").unwrap());
            END.is_match(line)
        }

        HtmlBlockKind::Comment => line.contains("-->"),
        HtmlBlockKind::ProcessingInstruction => line.contains("?>"),
        HtmlBlockKind::Declaration => line.contains('>'),
        HtmlBlockKind::Cdata => line.contains("]]>"),
        HtmlBlockKind::BlockTag | HtmlBlockKind::CompleteTag => {
            line.bytes().all(|b| matches!(b, b' ' | b'\t'))
        }
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
            AnyPayload::new(markdown_commonmark_contracts::HtmlBlock { literal }),
        ),
    )))
}

fn block_end(
    input: &BlockInput<'_>,
    kind: HtmlBlockKind,
    budget: &mut Budget,
) -> Result<LineIndex, ParseError> {
    let mut end = input.start + 1;

    if !closes(kind, input.current()) {
        while end < input.lines.end() {
            let line = input.line(end);
            budget.spend(line.len())?;

            if closes(kind, line) {
                if !kind.blank_terminated() {
                    end += 1;
                }
                break;
            }

            end += 1;
        }
    }

    Ok(end)
}
