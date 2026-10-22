use crate::{ParseError, engine::Budget};

/// Coordinates in original UTF-8 source and a normalized parser view cannot be
/// substituted for one another. Conversion is performed by SourceView.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct SourceOffset(pub(crate) usize);
impl SourceOffset {
    pub fn get(self) -> usize {
        self.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct ViewOffset(pub(crate) usize);
impl ViewOffset {
    pub fn get(self) -> usize {
        self.0
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
