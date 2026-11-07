use crate::{ParseError, Span, engine::Budget};
use std::ops::Range;

/// Exact origins, independently of the boundary offsets used for AST envelopes.
/// Ordinary source is one linear segment; normalization and selection split it
/// only where necessary. A replacement character or expanded tab is atomic.
#[derive(Default)]
pub(super) struct SourceMap {
    segments: Vec<Segment>,
}

struct Segment {
    view: Range<usize>,
    source: Span,
    linear: bool,
}

impl SourceMap {
    pub fn append(&mut self, view: Range<usize>, source: Span) {
        let linear = view.len() == source.end - source.start;

        self.push(Segment {
            view,
            source,
            linear,
        });
    }

    fn push(&mut self, segment: Segment) {
        if segment.view.is_empty() {
            return;
        }

        if let Some(previous) = self.segments.last_mut()
            && previous.view.end == segment.view.start
            && ((previous.linear && segment.linear && previous.source.end == segment.source.start)
                || (!previous.linear && !segment.linear && previous.source == segment.source))
        {
            previous.view.end = segment.view.end;
            previous.source.end = segment.source.end;
        } else {
            self.segments.push(segment);
        }
    }

    /// Copy a selected interval, retaining each transformation's atomic origin.
    pub fn append_from(&mut self, source: &Self, range: Range<usize>, at: usize) {
        for mut segment in source.selected(range.clone()) {
            segment.view =
                at + segment.view.start - range.start..at + segment.view.end - range.start;

            self.push(segment);
        }
    }

    /// Transformations of a tab always originate in one source character,
    /// including when that tab was previously expanded and restored.
    pub fn character_span(&self, range: Range<usize>) -> Span {
        let mut segments = self.selected(range);
        let segment = segments.next().expect("a character has a source origin");
        debug_assert!(segments.next().is_none());
        segment.source
    }

    pub fn spans(
        &self,
        range: Range<usize>,
        mut budget: Option<&mut Budget>,
    ) -> Result<Vec<Span>, ParseError> {
        let mut spans: Vec<Span> = vec![];

        for segment in self.selected(range) {
            if let Some(budget) = &mut budget {
                budget.spend(1)?;
            }

            let span = segment.source;

            if let Some(previous) = spans.last_mut()
                && previous.start <= span.start
                && span.start <= previous.end
            {
                previous.end = previous.end.max(span.end);
            } else {
                spans.push(span);
            }
        }

        Ok(spans)
    }

    pub fn segment_count(&self, range: Range<usize>) -> usize {
        self.selected(range).count()
    }

    fn selected(&self, range: Range<usize>) -> impl Iterator<Item = Segment> + '_ {
        let first = self
            .segments
            .partition_point(|segment| segment.view.end <= range.start);

        self.segments[first..]
            .iter()
            .take_while(move |segment| segment.view.start < range.end)
            .filter_map(move |segment| {
                let start = segment.view.start.max(range.start);
                let end = segment.view.end.min(range.end);

                (start < end).then(|| Segment {
                    view: start..end,
                    source: if segment.linear {
                        Span {
                            start: segment.source.start + start - segment.view.start,
                            end: segment.source.start + end - segment.view.start,
                        }
                    } else {
                        segment.source
                    },
                    linear: segment.linear,
                })
            })
    }
}
