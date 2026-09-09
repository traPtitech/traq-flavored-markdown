use crate::{ParseError, Span};
use std::{any::Any, borrow::Cow, ops::Range, sync::Arc};

mod context;
#[cfg(test)]
mod tests;

pub struct SourceView {
    context: Vec<Arc<dyn Any + Send + Sync>>,
    pub(crate) text: String,
    // SourceView UTF-8 byte boundary -> original UTF-8 byte boundary.
    // Only character boundaries are used; replacement-character interiors are
    // mapped to the original start and never sliced by the parser.
    offsets: Vec<usize>,
    // Whole tab expansions in the block view. A partially consumed tab is
    // deliberately absent: its remaining columns are literal spaces.
    tabs: Vec<Range<usize>>,
}

impl SourceView {
    pub fn text(&self) -> &str {
        &self.text
    }

    pub fn span_for(&self, range: Range<usize>) -> Result<Span, ParseError> {
        if range.start > range.end
            || !self.text.is_char_boundary(range.start)
            || !self.text.is_char_boundary(range.end)
        {
            return Err(ParseError::InternalError);
        }
        Ok(self.span(range.start, range.end))
    }

    pub fn join(&self, ranges: &[Range<usize>]) -> Result<Self, ParseError> {
        for range in ranges {
            self.span_for(range.clone())?;
        }
        Ok(self.select(ranges))
    }

    pub fn work_len(&self) -> usize {
        // Child views copy context handles, not the extension-owned values.
        self.text.len() + self.tabs.len() * 2 + self.context.len()
    }

    pub(crate) fn select(&self, ranges: &[std::ops::Range<usize>]) -> Self {
        let mut text = String::new();
        let mut offsets = vec![0];
        let mut tabs = vec![];

        for range in ranges {
            let start = text.len();
            tabs.extend(
                self.tabs_in(range)
                    .map(|tab| start + tab.start - range.start..start + tab.end - range.start),
            );
            *offsets.last_mut().unwrap() = self.offsets[range.start];
            text.push_str(&self.text[range.clone()]);
            offsets.extend_from_slice(&self.offsets[range.start + 1..=range.end]);
        }

        Self {
            context: self.context.clone(),
            text,
            offsets,
            tabs,
        }
    }

    fn tabs_in<'a>(&'a self, range: &'a Range<usize>) -> impl Iterator<Item = &'a Range<usize>> {
        self.tabs[self.tabs.partition_point(|tab| tab.start < range.start)..]
            .iter()
            .take_while(move |tab| tab.end <= range.end)
    }

    pub fn expand_tabs(&self) -> Self {
        let mut text = String::with_capacity(self.text.len());
        let mut offsets = vec![self.offsets[0]];
        let mut tabs = vec![];
        let mut column = 0;

        for (pos, ch) in self.text.char_indices() {
            if ch == '\t' {
                let width = 4 - column % 4;
                tabs.push(text.len()..text.len() + width);
                text.extend(std::iter::repeat_n(' ', width));

                offsets.extend(std::iter::repeat_n(self.offsets[pos], width - 1));
                offsets.push(self.offsets[pos + 1]);
                column += width;
            } else {
                text.push(ch);
                offsets.extend_from_slice(&self.offsets[pos + 1..=pos + ch.len_utf8()]);
                column = if ch == '\n' { 0 } else { column + 1 };
            }
        }

        Self {
            context: self.context.clone(),
            text,
            offsets,
            tabs,
        }
    }

    pub fn literal(&self, range: Range<usize>) -> Cow<'_, str> {
        let mut tabs = self.tabs_in(&range).peekable();

        if tabs.peek().is_none() {
            return Cow::Borrowed(&self.text[range.clone()]);
        }

        let mut text = String::new();
        let mut pos = range.start;

        for tab in tabs {
            text.push_str(&self.text[pos..tab.start]);
            text.push('\t');
            pos = tab.end;
        }

        text.push_str(&self.text[pos..range.end]);
        Cow::Owned(text)
    }

    pub fn restore_tabs(self) -> Self {
        if self.tabs.is_empty() {
            return self;
        }

        let mut text = String::new();
        let mut offsets = vec![self.offsets[0]];
        let mut pos = 0;

        for tab in &self.tabs {
            text.push_str(&self.text[pos..tab.start]);
            offsets.extend_from_slice(&self.offsets[pos + 1..=tab.start]);
            text.push('\t');
            offsets.push(self.offsets[tab.end]);
            pos = tab.end;
        }

        text.push_str(&self.text[pos..]);
        offsets.extend_from_slice(&self.offsets[pos + 1..]);

        Self {
            context: self.context,
            text,
            offsets,
            tabs: vec![],
        }
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

        Self {
            context: vec![],
            text,
            offsets,
            tabs: vec![],
        }
    }

    pub(crate) fn span(&self, start: usize, end: usize) -> Span {
        debug_assert!(
            start <= end && self.text.is_char_boundary(start) && self.text.is_char_boundary(end)
        );

        Span {
            start: self.offsets[start],
            end: self.offsets[end],
        }
    }
}
