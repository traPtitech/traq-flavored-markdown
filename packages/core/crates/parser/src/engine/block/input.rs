use super::{BlockInput, BlockMatch, DraftContent, DraftNode};
use crate::{NodeKind, ParseError, Span, engine::source::SourceView};
use std::ops::Range;

impl BlockInput<'_> {
    /// Map a consumed line interval to the original UTF-8 source, including its newline.
    pub fn span_until(&self, end: usize) -> Result<Span, ParseError> {
        if self.start >= end || end > self.lines.len() {
            return Err(ParseError::InternalError);
        }

        self.source
            .span_for(self.lines[self.start].start..self.lines[end - 1].end)
    }

    /// Select body lines, including an empty body at any valid line boundary.
    pub fn body(&self, lines: Range<usize>) -> Result<SourceView, ParseError> {
        if lines.start > lines.end || lines.end > self.lines.len() {
            return Err(ParseError::InternalError);
        }

        if lines.is_empty() {
            let position = self
                .lines
                .get(lines.start)
                .map_or(self.source.text().len(), |r| r.start);

            self.source.join(&[position..position])
        } else {
            self.source.join(&self.lines[lines])
        }
    }

    pub fn matched(
        &self,
        end: usize,
        kind: NodeKind,
        content: DraftContent,
    ) -> Result<BlockMatch, ParseError> {
        Ok(BlockMatch::node(
            end,
            DraftNode::new(self.span_until(end)?, kind, content),
        ))
    }

    pub fn leaf(&self, end: usize, kind: NodeKind) -> Result<BlockMatch, ParseError> {
        self.matched(end, kind, DraftContent::Leaf)
    }

    pub fn blocks(
        &self,
        end: usize,
        kind: NodeKind,
        body: Range<usize>,
    ) -> Result<BlockMatch, ParseError> {
        self.matched(end, kind, DraftContent::Blocks(self.body(body)?))
    }
}
