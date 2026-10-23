use crate::{ParseError, Span};
use std::{any::Any, borrow::Cow, ops::Range, sync::Arc};

mod context;
mod cursor;
pub use cursor::{Cursor, SourceOffset, ViewOffset, ViewRange};
#[cfg(test)]
mod tests;

#[derive(Clone)]
pub struct SourceView {
    context: Vec<Arc<dyn Any + Send + Sync>>,
    backing: Arc<MappedSource>,
    range: Range<usize>,
}

struct MappedSource {
    text: String,
    // SourceView UTF-8 byte boundary -> original UTF-8 byte boundary.
    // Only character boundaries are used; replacement-character interiors are
    // mapped to the original start and never sliced by the parser.
    offsets: Vec<usize>,
    // Whole tab expansions in the block view. A partially consumed tab is
    // deliberately absent: its remaining columns are literal spaces.
    tabs: Vec<Range<usize>>,
}

impl SourceView {
    pub fn offset(&self, position: usize) -> Result<ViewOffset, ParseError> {
        if self.text().is_char_boundary(position) {
            Ok(ViewOffset(position))
        } else {
            Err(ParseError::InternalError)
        }
    }
    /// Convert checked scanner byte indexes into view coordinates.
    pub fn range(&self, range: Range<usize>) -> Result<ViewRange, ParseError> {
        if range.start > range.end {
            return Err(ParseError::InternalError);
        }
        Ok(self.offset(range.start)?..self.offset(range.end)?)
    }
    pub fn source_offset(&self, position: ViewOffset) -> Result<SourceOffset, ParseError> {
        self.offset(position.get())?;
        Ok(SourceOffset(self.offsets()[position.get()]))
    }
    pub fn cursor<'a, 'b>(
        &'a self,
        position: ViewOffset,
        budget: &'b mut crate::engine::Budget,
    ) -> Result<Cursor<'a, 'b>, ParseError> {
        Cursor::new(self.text(), position, budget)
    }
    pub fn text(&self) -> &str {
        &self.backing.text[self.range.clone()]
    }

    fn offsets(&self) -> &[usize] {
        &self.backing.offsets[self.range.start..=self.range.end]
    }

    fn mapped(
        context: Vec<Arc<dyn Any + Send + Sync>>,
        text: String,
        offsets: Vec<usize>,
        tabs: Vec<Range<usize>>,
    ) -> Self {
        let range = 0..text.len();
        Self {
            context,
            backing: Arc::new(MappedSource {
                text,
                offsets,
                tabs,
            }),
            range,
        }
    }

    pub fn span_for(&self, range: ViewRange) -> Result<Span, ParseError> {
        let range = range.start.get()..range.end.get();
        if range.start > range.end
            || !self.text().is_char_boundary(range.start)
            || !self.text().is_char_boundary(range.end)
        {
            return Err(ParseError::InternalError);
        }
        Ok(self.span(range.start, range.end))
    }

    pub fn join(&self, ranges: &[ViewRange]) -> Result<Self, ParseError> {
        for range in ranges {
            self.span_for(range.clone())?;
        }
        Ok(self.select(ranges))
    }

    pub fn work_len(&self) -> usize {
        // Child views copy context handles, not the extension-owned values.
        self.text().len() + self.tabs_in(&(0..self.text().len())).count() * 2 + self.context.len()
    }

    fn select(&self, ranges: &[ViewRange]) -> Self {
        if let Some(first) = ranges.first()
            && ranges.windows(2).all(|pair| pair[0].end == pair[1].start)
        {
            return Self {
                context: self.context.clone(),
                backing: self.backing.clone(),
                range: self.range.start + first.start.get()
                    ..self.range.start + ranges.last().unwrap().end.get(),
            };
        }
        let mut text = String::new();
        let mut offsets = vec![self.offsets()[0]];
        let mut tabs = vec![];

        for range in ranges {
            let range = &(range.start.get()..range.end.get());
            let start = text.len();
            tabs.extend(
                self.tabs_in(range)
                    .map(|tab| start + tab.start - range.start..start + tab.end - range.start),
            );
            *offsets.last_mut().unwrap() = self.offsets()[range.start];
            text.push_str(&self.text()[range.clone()]);
            offsets.extend_from_slice(&self.offsets()[range.start + 1..=range.end]);
        }

        Self::mapped(self.context.clone(), text, offsets, tabs)
    }

    fn tabs_in(&self, range: &Range<usize>) -> impl Iterator<Item = Range<usize>> + '_ {
        let start = self.range.start + range.start;
        let end = self.range.start + range.end;
        self.backing.tabs[self.backing.tabs.partition_point(|tab| tab.start < start)..]
            .iter()
            .take_while(move |tab| tab.end <= end)
            .map(|tab| tab.start - self.range.start..tab.end - self.range.start)
    }

    pub fn expand_tabs(&self) -> Self {
        let mut text = String::with_capacity(self.text().len());
        let mut offsets = vec![self.offsets()[0]];
        let mut tabs = vec![];
        let mut column = 0;

        for (pos, ch) in self.text().char_indices() {
            if ch == '\t' {
                let width = 4 - column % 4;
                tabs.push(text.len()..text.len() + width);
                text.extend(std::iter::repeat_n(' ', width));

                offsets.extend(std::iter::repeat_n(self.offsets()[pos], width - 1));
                offsets.push(self.offsets()[pos + 1]);
                column += width;
            } else {
                text.push(ch);
                offsets.extend_from_slice(&self.offsets()[pos + 1..=pos + ch.len_utf8()]);
                column = if ch == '\n' { 0 } else { column + 1 };
            }
        }

        Self::mapped(self.context.clone(), text, offsets, tabs)
    }

    pub fn literal(&self, range: ViewRange) -> Cow<'_, str> {
        let range = range.start.get()..range.end.get();
        let mut tabs = self.tabs_in(&range).peekable();

        if tabs.peek().is_none() {
            return Cow::Borrowed(&self.text()[range.clone()]);
        }

        let mut text = String::new();
        let mut pos = range.start;

        for tab in tabs {
            text.push_str(&self.text()[pos..tab.start]);
            text.push('\t');
            pos = tab.end;
        }

        text.push_str(&self.text()[pos..range.end]);
        Cow::Owned(text)
    }

    pub fn restore_tabs(self) -> Self {
        if self.tabs_in(&(0..self.text().len())).next().is_none() {
            return self;
        }

        let mut text = String::new();
        let mut offsets = vec![self.offsets()[0]];
        let mut pos = 0;

        for tab in self.tabs_in(&(0..self.text().len())) {
            text.push_str(&self.text()[pos..tab.start]);
            offsets.extend_from_slice(&self.offsets()[pos + 1..=tab.start]);
            text.push('\t');
            offsets.push(self.offsets()[tab.end]);
            pos = tab.end;
        }

        text.push_str(&self.text()[pos..]);
        offsets.extend_from_slice(&self.offsets()[pos + 1..]);

        Self::mapped(self.context, text, offsets, vec![])
    }

    pub(crate) fn new(source: &str) -> Self {
        let mut text = String::with_capacity(source.len());
        let mut offsets = vec![0];
        let mut chars = source.char_indices().peekable();

        while let Some((start, ch)) = chars.next() {
            match ch {
                '\r' => {
                    let end = if chars.peek().is_some_and(|(_, ch)| *ch == '\n') {
                        chars.next();
                        start + 2
                    } else {
                        start + 1
                    };
                    text.push('\n');
                    offsets.push(end);
                }

                '\0' => {
                    text.push('\u{fffd}');
                    offsets.extend([start, start, start + 1]);
                }

                _ => {
                    text.push(ch);
                    offsets.extend(start + 1..=start + ch.len_utf8());
                }
            }
        }

        Self::mapped(vec![], text, offsets, vec![])
    }

    pub(crate) fn span(&self, start: usize, end: usize) -> Span {
        debug_assert!(
            start <= end
                && self.text().is_char_boundary(start)
                && self.text().is_char_boundary(end)
        );

        Span {
            start: self.offsets()[start],
            end: self.offsets()[end],
        }
    }
}

impl std::ops::Index<ViewRange> for SourceView {
    type Output = str;
    fn index(&self, range: ViewRange) -> &Self::Output {
        &self.text()[range.start.get()..range.end.get()]
    }
}
