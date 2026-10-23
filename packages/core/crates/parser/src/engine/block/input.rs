use super::{BlockInput, BlockMatch, DraftContent, DraftNode, LineIndex};
use crate::{AnyPayload, ParseError, Span, engine::source::SourceView};
use std::ops::Range;

impl BlockInput<'_> {
    /// Map a consumed line interval to the original UTF-8 source, including its newline.
    pub fn span_until(&self, end: LineIndex) -> Result<Span, ParseError> {
        if self.start >= end || end > self.lines.end() {
            return Err(ParseError::InternalError);
        }

        self.source
            .span_for(self.lines[self.start].start..self.lines[end - 1].end)
    }

    /// Select body lines, including an empty body at any valid line boundary.
    pub fn body(&self, lines: Range<LineIndex>) -> Result<SourceView, ParseError> {
        if lines.start > lines.end || lines.end > self.lines.end() {
            return Err(ParseError::InternalError);
        }

        if lines.is_empty() {
            let position = self
                .lines
                .get(lines.start)
                .map_or(self.source.offset(self.source.text().len())?, |r| r.start);

            self.source.join(&[position..position])
        } else {
            self.source.join(&self.lines[lines])
        }
    }

    pub fn matched(
        &self,
        end: LineIndex,
        payload: AnyPayload,
        content: DraftContent,
    ) -> Result<BlockMatch, ParseError> {
        Ok(BlockMatch::node(
            end,
            DraftNode::new(self.span_until(end)?, payload, content),
        ))
    }

    pub fn leaf(&self, end: LineIndex, payload: AnyPayload) -> Result<BlockMatch, ParseError> {
        self.matched(end, payload, DraftContent::Leaf)
    }

    pub fn blocks(
        &self,
        end: LineIndex,
        payload: AnyPayload,
        body: Range<LineIndex>,
    ) -> Result<BlockMatch, ParseError> {
        self.matched(end, payload, DraftContent::Blocks(self.body(body)?))
    }
}
