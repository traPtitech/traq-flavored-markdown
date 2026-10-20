use markdown_ast::ValidationLimits;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(tag = "code", rename_all = "snake_case", deny_unknown_fields)]
pub enum ParseError {
    InvalidUtf8,
    ResourceLimit { resource: String },
    InternalError,
}

impl ParseError {
    pub(crate) fn limit(resource: &str) -> Self {
        Self::ResourceLimit {
            resource: resource.into(),
        }
    }
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{self:?}")
    }
}

impl std::error::Error for ParseError {}

#[derive(Debug, Clone, Copy)]
pub struct Limits {
    /// Source and tree limits shared with codecs and AST consumers.
    pub document: ValidationLimits,
    /// Parser-specific work budget, including failed rule attempts.
    pub work: usize,
    /// Maximum intermediate tokens, independent of the final AST size.
    pub tokens: usize,
    /// Maximum syntax nesting while scanning blocks, brackets, and destinations.
    pub nesting: usize,
}

impl Default for Limits {
    fn default() -> Self {
        Self {
            document: ValidationLimits::default(),
            work: 2_000_000,
            tokens: 16_384,
            nesting: 64,
        }
    }
}

/// Work spent by an unsuccessful rule is still charged to this parse.
pub struct Budget {
    pub(crate) limits: Limits,
    tokens: usize,
    nodes: usize,
    work: usize,
}

impl Budget {
    pub(crate) fn new(limits: Limits) -> Self {
        Self {
            limits,
            tokens: 0,
            nodes: 0,
            work: 0,
        }
    }

    pub fn spend(&mut self, work: usize) -> Result<(), ParseError> {
        self.work = self
            .work
            .checked_add(work)
            .ok_or_else(|| ParseError::limit("work"))?;

        if self.work > self.limits.work {
            return Err(ParseError::limit("work"));
        }

        Ok(())
    }

    pub(crate) fn remaining_work(&self) -> usize {
        self.limits.work.saturating_sub(self.work)
    }

    pub fn token(&mut self) -> Result<(), ParseError> {
        self.tokens = self
            .tokens
            .checked_add(1)
            .ok_or_else(|| ParseError::limit("tokens"))?;

        if self.tokens > self.limits.tokens {
            return Err(ParseError::limit("tokens"));
        }

        Ok(())
    }

    /// Charge a final AST node before it is inserted into an output vector.
    pub fn node(&mut self) -> Result<(), ParseError> {
        self.nodes = self
            .nodes
            .checked_add(1)
            .ok_or_else(|| ParseError::limit("nodes"))?;
        if self.nodes > self.limits.document.nodes {
            return Err(ParseError::limit("nodes"));
        }
        Ok(())
    }

    pub fn nesting(&self, depth: usize) -> Result<(), ParseError> {
        if depth > self.limits.nesting {
            return Err(ParseError::limit("nesting"));
        }

        Ok(())
    }
}
