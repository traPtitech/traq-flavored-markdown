use crate::engine::source::ViewRange;
use std::ops::{Add, AddAssign, Index, Range, Sub};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct LineIndex(usize);
impl LineIndex {
    pub const fn new(index: usize) -> Self {
        Self(index)
    }
    pub fn get(self) -> usize {
        self.0
    }
}
impl Add<usize> for LineIndex {
    type Output = Self;
    fn add(self, n: usize) -> Self {
        Self(self.0 + n)
    }
}
impl AddAssign<usize> for LineIndex {
    fn add_assign(&mut self, n: usize) {
        self.0 += n;
    }
}
impl Sub<usize> for LineIndex {
    type Output = Self;
    fn sub(self, n: usize) -> Self {
        Self(self.0 - n)
    }
}
impl Sub for LineIndex {
    type Output = usize;
    fn sub(self, other: Self) -> usize {
        self.0 - other.0
    }
}

/// Line indexing is distinct from byte indexing into a source view.
#[derive(Clone, Copy)]
pub struct Lines<'a>(pub(crate) &'a [ViewRange]);
impl<'a> Lines<'a> {
    pub fn len(self) -> usize {
        self.0.len()
    }
    pub fn is_empty(self) -> bool {
        self.0.is_empty()
    }
    pub fn end(self) -> LineIndex {
        LineIndex(self.0.len())
    }
    pub fn get(self, index: LineIndex) -> Option<&'a ViewRange> {
        self.0.get(index.0)
    }
    pub fn indices(self, range: Range<LineIndex>) -> impl DoubleEndedIterator<Item = LineIndex> {
        (range.start.0..range.end.0).map(LineIndex)
    }
}
impl Index<LineIndex> for Lines<'_> {
    type Output = ViewRange;
    fn index(&self, index: LineIndex) -> &Self::Output {
        &self.0[index.0]
    }
}
impl Index<Range<LineIndex>> for Lines<'_> {
    type Output = [ViewRange];
    fn index(&self, range: Range<LineIndex>) -> &Self::Output {
        &self.0[range.start.0..range.end.0]
    }
}
impl Index<std::ops::RangeFrom<LineIndex>> for Lines<'_> {
    type Output = [ViewRange];
    fn index(&self, range: std::ops::RangeFrom<LineIndex>) -> &Self::Output {
        &self.0[range.start.0..]
    }
}
