use markdown_parser::ParseError;
use markdown_parser::rules::ParseState;
use markdown_parser::rules::block::BlockInput;
use markdown_parser::rules::block::BlockPolicy;
use markdown_parser::rules::block::LineIndex;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Interrupt {
    Paragraph,
    LazyContinuation,
    Reference,
    BlockBody,
}

#[derive(Default)]
pub(crate) struct BlockSpacing {
    pub loose: bool,
    last_nonblank: Option<LineIndex>,
}

pub(crate) struct CommonmarkBlocks;
impl BlockPolicy for CommonmarkBlocks {
    fn after_match(
        &self,
        input: &BlockInput<'_>,
        end: LineIndex,
        metadata: &mut ParseState,
    ) -> Result<LineIndex, ParseError> {
        let spacing = metadata.get_or_default::<BlockSpacing>();
        let last_nonblank = *spacing.last_nonblank.get_or_insert_with(|| {
            input
                .lines
                .indices(LineIndex::new(0)..input.lines.end())
                .rfind(|&index| !super::markers::blank(input.line(index)))
                .unwrap_or(LineIndex::new(0))
        });
        if end < input.lines.end() && super::markers::blank(input.line(end)) {
            spacing.loose |= end < last_nonblank;
            Ok(end + 1)
        } else {
            Ok(end)
        }
    }
}
