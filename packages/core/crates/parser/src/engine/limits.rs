use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "contracts", derive(ts_rs::TS))]
#[serde(tag = "code", rename_all = "snake_case")]
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
    pub input_bytes: usize,
    pub nodes: usize,
    pub depth: usize,
    pub work: usize,
}

impl Default for Limits {
    fn default() -> Self {
        Self {
            input_bytes: 65_536,
            nodes: 16_384,
            depth: 64,
            work: 2_000_000,
        }
    }
}

/// Work spent by an unsuccessful rule is still charged to this parse.
pub struct Budget {
    pub(crate) limits: Limits,
    tokens: usize,
    work: usize,
}

impl Budget {
    pub(crate) fn new(limits: Limits) -> Self {
        Self {
            limits,
            tokens: 0,
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

        if self.tokens > self.limits.nodes {
            return Err(ParseError::limit("tokens"));
        }

        Ok(())
    }

    pub fn depth(&self, depth: usize) -> Result<(), ParseError> {
        if depth > self.limits.depth {
            return Err(ParseError::limit("depth"));
        }

        Ok(())
    }
}
