use crate::{Document, Span};

#[derive(Debug, Clone, Copy)]
pub struct ValidationLimits {
    pub source_bytes: usize,
    pub nodes: usize,
    pub depth: usize,
}

impl Default for ValidationLimits {
    fn default() -> Self {
        Self {
            source_bytes: 65_536,
            nodes: 16_384,
            depth: 64,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ValidationError {
    SourceBytes,
    Nodes,
    Depth,
    InvalidSpan,
    InvalidNode,
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::SourceBytes => "source byte limit",
            Self::Nodes => "node limit",
            Self::Depth => "depth limit",
            Self::InvalidSpan => "invalid span",
            Self::InvalidNode => "invalid node shape",
        })
    }
}

impl std::error::Error for ValidationError {}

impl Document {
    /// Validate the entire tree and return its node count. No handlers execute.
    ///
    /// Checks source size, depth, node count, nested UTF-8 spans and each node's
    /// type-owned validation. It does not check codec or handler registration.
    /// Validation is not cached: public nodes may be edited after this call.
    pub fn validate(&self, limits: ValidationLimits) -> Result<usize, ValidationError> {
        if self.source.len() > limits.source_bytes {
            return Err(ValidationError::SourceBytes);
        }

        let root = Span {
            start: 0,
            end: self.source.len(),
        };

        // Count scheduled nodes before extending the stack. Wide trees cannot
        // allocate more pending work than the configured node budget.
        let mut count = self.children.len();
        if count > limits.nodes {
            return Err(ValidationError::Nodes);
        }
        let mut pending: Vec<_> = self
            .children
            .iter()
            .rev()
            .map(|node| (node, 1, root))
            .collect();

        while let Some((node, depth, parent)) = pending.pop() {
            if depth > limits.depth {
                return Err(ValidationError::Depth);
            }

            let span = node.span;
            if span.start > span.end
                || span.start < parent.start
                || span.end > parent.end
                || !self.source.is_char_boundary(span.start)
                || !self.source.is_char_boundary(span.end)
            {
                return Err(ValidationError::InvalidSpan);
            }

            if !node.validate() {
                return Err(ValidationError::InvalidNode);
            }

            if node.children.len() > limits.nodes - count {
                return Err(ValidationError::Nodes);
            }

            count += node.children.len();

            if !node.children.is_empty() {
                if depth >= limits.depth {
                    return Err(ValidationError::Depth);
                }
                pending.extend(
                    node.children
                        .iter()
                        .rev()
                        .map(|child| (child, depth + 1, span)),
                );
            }
        }

        Ok(count)
    }
}
