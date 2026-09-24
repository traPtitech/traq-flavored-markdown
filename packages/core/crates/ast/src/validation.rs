use crate::{Document, Span};

/// Shared source and tree limits for parsers, codecs, and AST consumers.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

impl ValidationError {
    /// Common consumer error category; detailed validation errors remain available.
    pub fn code(self) -> &'static str {
        match self {
            Self::InvalidSpan | Self::InvalidNode => "invalid_node",
            Self::SourceBytes | Self::Nodes | Self::Depth => "resource_limit",
        }
    }
}

/// A document checked against the default consumer limits for this immutable borrow.
/// It does not assert codec registration, handler support, or source edit ordering.
/// Payload implementations must preserve their invariants during the borrow.
///
/// ```compile_fail
/// use markdown_ast::{Document, ValidatedDocument};
/// let mut document = Document { source: String::new(), children: vec![] };
/// let validated = ValidatedDocument::new(&document).unwrap();
/// document.source.push('x');
/// let _ = validated.document();
/// ```
#[derive(Clone, Copy)]
pub struct ValidatedDocument<'a>(&'a Document);

impl<'a> ValidatedDocument<'a> {
    pub fn new(document: &'a Document) -> Result<Self, ValidationError> {
        document.validate(ValidationLimits::default())?;
        Ok(Self(document))
    }

    pub fn document(self) -> &'a Document {
        self.0
    }
}

impl Document {
    /// Validate the entire tree and return its node count. No handlers execute.
    ///
    /// Checks source size, depth, node count, nested UTF-8 spans, ordered and
    /// non-overlapping siblings, and each node's type-owned validation. It does
    /// not check codec or handler registration.
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
            .enumerate()
            .rev()
            .map(|(index, node)| {
                let previous_end = if index == 0 {
                    root.start
                } else {
                    self.children[index - 1].span.end
                };
                (node, 1, root, previous_end)
            })
            .collect();

        while let Some((node, depth, parent, previous_end)) = pending.pop() {
            if depth > limits.depth {
                return Err(ValidationError::Depth);
            }

            let span = node.span;
            if !span.valid_child_of(parent, previous_end, &self.source) {
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
                        .enumerate()
                        .rev()
                        .map(|(index, child)| {
                            let previous_end = if index == 0 {
                                span.start
                            } else {
                                node.children[index - 1].span.end
                            };
                            (child, depth + 1, span, previous_end)
                        }),
                );
            }
        }

        Ok(count)
    }
}
