use super::Budget;
use crate::{ParseError, Span};
use std::{any::Any, borrow::Cow, ops::Range, sync::Arc};

mod context;
mod cursor;
mod mapping;
pub use cursor::{Cursor, SourceOffset, ViewOffset, ViewRange};
use mapping::SourceMap;

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
    // Exact selected source, including the ends lost at joined boundaries.
    origins: SourceMap,
    // Whole tab expansions in the block view. A partially consumed tab is
    // deliberately absent: its remaining columns are literal spaces.
    tabs: Vec<Range<usize>>,
}

impl SourceView {
    /// Whether this parse requested optional source facts.
    pub fn captures_syntax(&self) -> bool {
        self.context::<super::syntax::CaptureSyntax>().is_some()
    }

    /// Map rule-owned content and markers only when parsing with syntax capture.
    /// Each visited origin segment is charged before output spans are coalesced.
    pub fn syntax(
        &self,
        content: &[ViewRange],
        markers: &[(super::syntax::MarkerKind, ViewRange)],
        budget: &mut Budget,
    ) -> Result<Option<super::syntax::SourceSyntax>, ParseError> {
        use super::syntax::{SourceSyntax, SyntaxMarker};

        if !self.captures_syntax() {
            return Ok(None);
        }

        let mut facts = SourceSyntax::default();

        for range in content {
            facts
                .content
                .extend(self.mapped_source_spans(range.clone(), Some(budget))?);
        }

        for (kind, range) in markers {
            let spans = self.mapped_source_spans(range.clone(), Some(budget))?;

            if !spans.is_empty() {
                facts.markers.push(SyntaxMarker {
                    kind: *kind,
                    spans,
                    columns: None,
                    text: None,
                });
            }
        }

        Ok(Some(facts))
    }

    /// Prefixes retain their consumed column count even when a tab was only
    /// partly consumed and the original byte cannot be split.
    pub fn prefix_syntax(
        &self,
        content: &[ViewRange],
        prefixes: impl IntoIterator<Item = ViewRange>,
        budget: &mut Budget,
    ) -> Result<Option<super::syntax::SourceSyntax>, ParseError> {
        let mut syntax = self.syntax(content, &[], budget)?;

        if let Some(syntax) = &mut syntax {
            for prefix in prefixes {
                let spans = self.mapped_source_spans(prefix.clone(), Some(budget))?;

                if !spans.is_empty() {
                    syntax.markers.push(super::syntax::SyntaxMarker {
                        kind: super::syntax::MarkerKind::Prefix,
                        spans,
                        columns: Some(prefix.end - prefix.start),
                        text: Some(self.literal(prefix.clone()).into_owned()),
                    });
                }
            }
        }

        Ok(syntax)
    }

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
        origins: SourceMap,
    ) -> Self {
        let range = 0..text.len();

        Self {
            context,
            backing: Arc::new(MappedSource {
                text,
                offsets,
                tabs,
                origins,
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

    /// Original UTF-8 byte spans contributing to a view range. Unlike
    /// `span_for`, this excludes source removed between joined fragments.
    ///
    /// Spans follow view order. Successive, forward source spans that touch or
    /// overlap are coalesced. An empty range returns no spans. A normalized
    /// character maps to its entire original spelling (for example CRLF or
    /// NUL); any part of an expanded tab maps to the whole original tab.
    pub fn source_spans(&self, range: ViewRange) -> Result<Vec<Span>, ParseError> {
        self.mapped_source_spans(range, None)
    }

    fn mapped_source_spans(
        &self,
        range: ViewRange,
        budget: Option<&mut Budget>,
    ) -> Result<Vec<Span>, ParseError> {
        self.span_for(range.clone())?;

        self.backing.origins.spans(
            self.range.start + range.start.get()..self.range.start + range.end.get(),
            budget,
        )
    }

    fn copy_origins(&self, range: Range<usize>, at: usize, origins: &mut SourceMap) {
        origins.append_from(
            &self.backing.origins,
            self.range.start + range.start..self.range.start + range.end,
            at,
        );
    }

    fn character_origin(&self, range: Range<usize>) -> Span {
        self.backing
            .origins
            .character_span(self.range.start + range.start..self.range.start + range.end)
    }

    pub fn join(&self, ranges: &[ViewRange]) -> Result<Self, ParseError> {
        for range in ranges {
            self.span_for(range.clone())?;
        }

        Ok(self.select(ranges))
    }

    pub fn work_len(&self) -> usize {
        // Child views copy context handles, not the extension-owned values.
        self.text().len()
            + self.tabs_in(&(0..self.text().len())).count() * 2
            + self.backing.origins.segment_count(self.range.clone())
            + self.context.len()
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
        let mut origins = SourceMap::default();

        for range in ranges {
            let range = &(range.start.get()..range.end.get());
            let start = text.len();

            tabs.extend(
                self.tabs_in(range)
                    .map(|tab| start + tab.start - range.start..start + tab.end - range.start),
            );

            *offsets.last_mut().unwrap() = self.offsets()[range.start];
            self.copy_origins(range.clone(), start, &mut origins);
            text.push_str(&self.text()[range.clone()]);
            offsets.extend_from_slice(&self.offsets()[range.start + 1..=range.end]);
        }

        Self::mapped(self.context.clone(), text, offsets, tabs, origins)
    }

    fn tabs_in(&self, range: &Range<usize>) -> impl Iterator<Item = Range<usize>> + '_ {
        let start = self.range.start + range.start;
        let end = self.range.start + range.end;

        self.backing.tabs[self.backing.tabs.partition_point(|tab| tab.start < start)..]
            .iter()
            .take_while(move |tab| tab.end <= end)
            .map(|tab| tab.start - self.range.start..tab.end - self.range.start)
    }

    #[must_use]
    pub fn expand_tabs(&self) -> Self {
        let mut text = String::with_capacity(self.text().len());
        let mut offsets = vec![self.offsets()[0]];
        let mut tabs = vec![];
        let mut origins = SourceMap::default();
        let mut column = 0;
        let mut copied_from = 0;
        let mut copied_to = 0;

        for (pos, ch) in self.text().char_indices() {
            if ch == '\t' {
                self.copy_origins(copied_from..pos, copied_to, &mut origins);
                let width = 4 - column % 4;

                origins.append(
                    text.len()..text.len() + width,
                    self.character_origin(pos..pos + 1),
                );

                tabs.push(text.len()..text.len() + width);
                text.extend(std::iter::repeat_n(' ', width));

                offsets.extend(std::iter::repeat_n(self.offsets()[pos], width - 1));
                offsets.push(self.offsets()[pos + 1]);
                column += width;
                copied_from = pos + 1;
                copied_to = text.len();
            } else {
                text.push(ch);
                offsets.extend_from_slice(&self.offsets()[pos + 1..=pos + ch.len_utf8()]);
                column = if ch == '\n' { 0 } else { column + 1 };
            }
        }

        self.copy_origins(copied_from..self.text().len(), copied_to, &mut origins);

        Self::mapped(self.context.clone(), text, offsets, tabs, origins)
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

    #[must_use]
    pub fn restore_tabs(self) -> Self {
        if self.tabs_in(&(0..self.text().len())).next().is_none() {
            return self;
        }

        let mut text = String::new();
        let mut offsets = vec![self.offsets()[0]];
        let mut origins = SourceMap::default();
        let mut pos = 0;

        for tab in self.tabs_in(&(0..self.text().len())) {
            self.copy_origins(pos..tab.start, text.len(), &mut origins);
            text.push_str(&self.text()[pos..tab.start]);
            offsets.extend_from_slice(&self.offsets()[pos + 1..=tab.start]);

            origins.append(
                text.len()..text.len() + 1,
                self.character_origin(tab.clone()),
            );

            text.push('\t');
            offsets.push(self.offsets()[tab.end]);
            pos = tab.end;
        }

        self.copy_origins(pos..self.text().len(), text.len(), &mut origins);
        text.push_str(&self.text()[pos..]);
        offsets.extend_from_slice(&self.offsets()[pos + 1..]);

        Self::mapped(self.context, text, offsets, vec![], origins)
    }

    pub(crate) fn new(source: &str) -> Self {
        let mut text = String::with_capacity(source.len());
        let mut offsets = vec![0];
        let mut origins = SourceMap::default();
        let mut chars = source.char_indices().peekable();

        while let Some((start, ch)) = chars.next() {
            let view_start = text.len();

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
                    origins.append(view_start..text.len(), Span { start, end });
                }

                '\0' => {
                    text.push('\u{fffd}');
                    offsets.extend([start, start, start + 1]);

                    origins.append(
                        view_start..text.len(),
                        Span {
                            start,
                            end: start + 1,
                        },
                    );
                }

                _ => {
                    text.push(ch);
                    offsets.extend(start + 1..=start + ch.len_utf8());

                    origins.append(
                        view_start..text.len(),
                        Span {
                            start,
                            end: start + ch.len_utf8(),
                        },
                    );
                }
            }
        }

        Self::mapped(vec![], text, offsets, vec![], origins)
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
