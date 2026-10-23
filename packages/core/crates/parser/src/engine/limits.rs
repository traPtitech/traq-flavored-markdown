use markdown_ast::{ValidationError, ValidationLimits};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParsePhase {
    Block,
    Inline,
    Text,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ParseError {
    ResourceLimit {
        resource: ParseResource,
    },
    /// A plugin broke its parser-output contract. Position is an original
    /// source byte offset, so diagnostics remain useful for normalized views.
    InvalidRuleOutput {
        phase: ParsePhase,
        rule: Option<String>,
        position: usize,
        reason: String,
    },
    /// The final native tree failed a payload or source-structure contract.
    InvalidDocument(ValidationError),
    InternalError,
}

impl ParseError {
    pub(crate) fn limit(resource: ParseResource) -> Self {
        Self::ResourceLimit { resource }
    }

    pub(crate) fn invalid_rule(
        phase: ParsePhase,
        rule: Option<&str>,
        position: usize,
        reason: impl Into<String>,
    ) -> Self {
        Self::InvalidRuleOutput {
            phase,
            rule: rule.map(str::to_owned),
            position,
            reason: reason.into(),
        }
    }

    pub(crate) fn at_rule(self, phase: ParsePhase, rule: Option<&str>, position: usize) -> Self {
        match self {
            Self::InternalError => Self::invalid_rule(
                phase,
                rule,
                position,
                "rule used an invalid source range or parser action",
            ),
            error => error,
        }
    }
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{self:?}")
    }
}

impl std::error::Error for ParseError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::InvalidDocument(error) => Some(error),
            _ => None,
        }
    }
}

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
            .ok_or_else(|| ParseError::limit(ParseResource::Work))?;

        if self.work > self.limits.work {
            return Err(ParseError::limit(ParseResource::Work));
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
            .ok_or_else(|| ParseError::limit(ParseResource::Tokens))?;

        if self.tokens > self.limits.tokens {
            return Err(ParseError::limit(ParseResource::Tokens));
        }

        Ok(())
    }

    /// Charge a final AST node before it is inserted into an output vector.
    pub fn node(&mut self) -> Result<(), ParseError> {
        self.nodes = self
            .nodes
            .checked_add(1)
            .ok_or_else(|| ParseError::limit(ParseResource::Nodes))?;
        if self.nodes > self.limits.document.nodes {
            return Err(ParseError::limit(ParseResource::Nodes));
        }
        Ok(())
    }

    pub fn nesting(&self, depth: usize) -> Result<(), ParseError> {
        if depth > self.limits.nesting {
            return Err(ParseError::limit(ParseResource::Nesting));
        }

        Ok(())
    }
}

/// A native parser budget, independent of transport error names.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParseResource {
    SourceBytes,
    PayloadBytes,
    Nodes,
    Depth,
    Work,
    Tokens,
    Nesting,
}
impl ParseResource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::SourceBytes => "source_bytes",
            Self::PayloadBytes => "payload_bytes",
            Self::Nodes => "nodes",
            Self::Depth => "depth",
            Self::Work => "work",
            Self::Tokens => "tokens",
            Self::Nesting => "nesting",
        }
    }
}
