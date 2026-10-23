use crate::{ParseError, engine::Budget};
use std::ops::{Add, AddAssign, Range, Sub};

/// Coordinates in original UTF-8 source and a normalized parser view cannot be
/// substituted for one another. Conversion is performed by SourceView.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct SourceOffset(pub(crate) usize);
impl SourceOffset {
    pub fn get(self) -> usize {
        self.0
    }
}

/// A byte position in a normalized or selected parser view. Rules preserve
/// this type until mapping the position back to the original source.
///
/// ```compile_fail
/// use markdown_parser::{rules::inline::InlineMatch, source::SourceOffset};
/// fn invalid_match(original: SourceOffset) -> InlineMatch {
///     InlineMatch::literal(original)
/// }
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct ViewOffset(pub(crate) usize);
impl ViewOffset {
    pub fn get(self) -> usize {
        self.0
    }
}

/// An interval measured in the current parser view, never in original source bytes.
pub type ViewRange = Range<ViewOffset>;

impl Add<usize> for ViewOffset {
    type Output = Self;
    fn add(self, bytes: usize) -> Self {
        Self(self.0 + bytes)
    }
}
impl AddAssign<usize> for ViewOffset {
    fn add_assign(&mut self, bytes: usize) {
        self.0 += bytes;
    }
}
impl Sub<usize> for ViewOffset {
    type Output = Self;
    fn sub(self, bytes: usize) -> Self {
        Self(self.0 - bytes)
    }
}
impl Sub for ViewOffset {
    type Output = usize;
    fn sub(self, other: Self) -> usize {
        self.0 - other.0
    }
}
impl std::fmt::Display for ViewOffset {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(formatter)
    }
}

/// A checked UTF-8 cursor. Advancing charges scan work even if its rule later
/// fails, and a failed move leaves the cursor at its previous boundary.
pub struct Cursor<'source, 'budget> {
    source: &'source str,
    position: ViewOffset,
    budget: &'budget mut Budget,
}
impl<'source, 'budget> Cursor<'source, 'budget> {
    pub fn new(
        source: &'source str,
        start: ViewOffset,
        budget: &'budget mut Budget,
    ) -> Result<Self, ParseError> {
        Self::from_byte_index(source, start.get(), budget)
    }

    /// Enter from a standalone byte scanner after checking its UTF-8 boundary.
    /// Rules with a SourceView should use its typed `cursor` method.
    pub fn from_byte_index(
        source: &'source str,
        start: usize,
        budget: &'budget mut Budget,
    ) -> Result<Self, ParseError> {
        if !source.is_char_boundary(start) {
            return Err(ParseError::InternalError);
        }
        Ok(Self {
            source,
            position: ViewOffset(start),
            budget,
        })
    }
    pub fn position(&self) -> ViewOffset {
        self.position
    }
    pub fn tail(&self) -> &'source str {
        &self.source[self.position.0..]
    }
    pub fn peek(&self) -> Option<char> {
        self.tail().chars().next()
    }
    pub fn advance(&mut self, bytes: usize) -> Result<(), ParseError> {
        let end = self
            .position
            .0
            .checked_add(bytes)
            .ok_or(ParseError::InternalError)?;
        if !self.source.is_char_boundary(end) {
            return Err(ParseError::InternalError);
        }
        self.budget.spend(bytes)?;
        self.position = ViewOffset(end);
        Ok(())
    }
    pub fn next_char(&mut self) -> Result<Option<char>, ParseError> {
        let next = self.peek();
        if let Some(value) = next {
            self.advance(value.len_utf8())?;
        }
        Ok(next)
    }
    pub fn skip_while(&mut self, predicate: impl Fn(char) -> bool) -> Result<(), ParseError> {
        while self.peek().is_some_and(&predicate) {
            self.next_char()?;
        }
        Ok(())
    }
    pub fn nesting(&self, depth: usize) -> Result<(), ParseError> {
        self.budget.nesting(depth)
    }
}
