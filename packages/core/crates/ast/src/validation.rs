use crate::{Document, Node, PayloadError, Span};

/// Shared source and tree limits for parsers, codecs, and AST consumers.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ValidationLimits {
    pub source_bytes: usize,
    pub payload_bytes: usize,
    pub nodes: usize,
    pub depth: usize,
}
impl Default for ValidationLimits {
    fn default() -> Self {
        Self {
            source_bytes: 65_536,
            payload_bytes: 8 * 1024 * 1024,
            nodes: 16_384,
            depth: 64,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ValidationErrorKind {
    SourceBytes,
    PayloadBytes,
    Nodes,
    Depth,
    InvalidSpan,
    InvalidNode,
}

/// A failure with its original location and native payload type. Paths are child
/// indices from the root; an empty path denotes the document.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidationError {
    pub kind: ValidationErrorKind,
    pub path: Vec<usize>,
    pub span: Option<Span>,
    pub payload_type: Option<&'static str>,
    pub payload: Option<PayloadError>,
}
impl ValidationError {
    fn document(kind: ValidationErrorKind) -> Self {
        Self {
            kind,
            path: vec![],
            span: None,
            payload_type: None,
            payload: None,
        }
    }
    fn node(kind: ValidationErrorKind, node: &Node, path: Vec<usize>) -> Self {
        Self {
            kind,
            path,
            span: Some(node.span),
            payload_type: Some(node.data_type_name()),
            payload: None,
        }
    }
    pub fn code(&self) -> &'static str {
        match self.kind {
            ValidationErrorKind::InvalidSpan | ValidationErrorKind::InvalidNode => "invalid_node",
            _ => "resource_limit",
        }
    }
    pub fn resource(&self) -> Option<&'static str> {
        match self.kind {
            ValidationErrorKind::SourceBytes => Some("source_bytes"),
            ValidationErrorKind::PayloadBytes => Some("payload_bytes"),
            ValidationErrorKind::Nodes => Some("nodes"),
            ValidationErrorKind::Depth => Some("depth"),
            _ => None,
        }
    }
}
impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self.kind {
            ValidationErrorKind::SourceBytes => "source byte limit",
            ValidationErrorKind::PayloadBytes => "payload byte limit",
            ValidationErrorKind::Nodes => "node limit",
            ValidationErrorKind::Depth => "depth limit",
            ValidationErrorKind::InvalidSpan => "invalid span",
            ValidationErrorKind::InvalidNode => "invalid node shape",
        })?;
        if !self.path.is_empty() {
            write!(f, " at children{:?}", self.path)?;
        }
        if let Some(payload) = &self.payload {
            write!(f, ": expected {}", payload.expected)?;
            if let Some(actual) = &payload.actual {
                write!(f, ", got {actual}")?;
            }
        }
        Ok(())
    }
}
impl std::error::Error for ValidationError {}

/// Facts collected during validation. Tightening limits later does not invoke
/// payload validation or walk the tree again.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct ValidationStats {
    pub source_bytes: usize,
    pub payload_bytes: usize,
    pub nodes: usize,
    pub depth: usize,
}
impl ValidationStats {
    fn check(self, limits: ValidationLimits) -> Result<(), ValidationError> {
        for (actual, limit, kind) in [
            (
                self.source_bytes,
                limits.source_bytes,
                ValidationErrorKind::SourceBytes,
            ),
            (
                self.payload_bytes,
                limits.payload_bytes,
                ValidationErrorKind::PayloadBytes,
            ),
            (self.nodes, limits.nodes, ValidationErrorKind::Nodes),
            (self.depth, limits.depth, ValidationErrorKind::Depth),
        ] {
            if actual > limit {
                return Err(ValidationError::document(kind));
            }
        }
        Ok(())
    }
}

/// A document checked for this immutable borrow. Mutable ASTs must be validated
/// again after editing. Payload implementations must preserve their invariants.
///
/// ```compile_fail
/// use markdown_ast::{Document, ValidatedDocument};
/// let mut document = Document { source: String::new(), children: vec![] };
/// let validated = ValidatedDocument::new(&document).unwrap();
/// document.source.push('x');
/// let _ = validated.document();
/// ```
#[derive(Debug, Clone, Copy)]
pub struct ValidatedDocument<'a> {
    document: &'a Document,
    stats: ValidationStats,
}
impl<'a> ValidatedDocument<'a> {
    pub fn new(document: &'a Document) -> Result<Self, ValidationError> {
        Self::with_limits(document, ValidationLimits::default())
    }
    pub fn with_limits(
        document: &'a Document,
        limits: ValidationLimits,
    ) -> Result<Self, ValidationError> {
        let stats = validate(document, limits)?;
        Ok(Self { document, stats })
    }
    pub fn document(self) -> &'a Document {
        self.document
    }
    pub fn stats(self) -> ValidationStats {
        self.stats
    }
    pub fn node_count(self) -> usize {
        self.stats.nodes
    }
    pub fn check_limits(self, limits: ValidationLimits) -> Result<(), ValidationError> {
        self.stats.check(limits)
    }
}

/// An immutable owner carrying validation across parser, codec, and consumer
/// boundaries. Mutable access consumes the owner and discards its proof.
#[derive(Debug, Clone)]
pub struct ValidatedDocumentBuf {
    document: Document,
    stats: ValidationStats,
}
impl ValidatedDocumentBuf {
    pub fn new(document: Document) -> Result<Self, ValidationError> {
        Self::with_limits(document, ValidationLimits::default())
    }
    pub fn with_limits(
        document: Document,
        limits: ValidationLimits,
    ) -> Result<Self, ValidationError> {
        let stats = validate(&document, limits)?;
        Ok(Self { document, stats })
    }
    pub fn validated(&self) -> ValidatedDocument<'_> {
        ValidatedDocument {
            document: &self.document,
            stats: self.stats,
        }
    }
    pub fn document(&self) -> &Document {
        &self.document
    }
    pub fn into_document(self) -> Document {
        self.document
    }
}
impl Document {
    /// Validate the complete native tree, including hidden or unknown node types.
    pub fn validate(&self, limits: ValidationLimits) -> Result<usize, ValidationError> {
        validate(self, limits).map(|stats| stats.nodes)
    }
}
fn validate(
    document: &Document,
    limits: ValidationLimits,
) -> Result<ValidationStats, ValidationError> {
    let mut stats = ValidationStats {
        source_bytes: document.source.len(),
        ..ValidationStats::default()
    };
    stats.check(limits)?;
    let root = Span {
        start: 0,
        end: document.source.len(),
    };
    // One frame per depth. Charge child count before visiting or allocating.
    let mut scheduled = document.children.len();
    if scheduled > limits.nodes {
        return Err(ValidationError::document(ValidationErrorKind::Nodes));
    }
    let mut stack = vec![(&document.children[..], root, 0usize)];
    let mut path = vec![];
    while let Some((children, parent, index)) = stack.last_mut() {
        if *index == children.len() {
            stack.pop();
            path.pop();
            continue;
        }
        let node = &children[*index];
        let previous_end = if *index == 0 {
            parent.start
        } else {
            children[*index - 1].span.end
        };
        path.push(*index);
        *index += 1;
        let failure = |kind| ValidationError::node(kind, node, path.clone());
        if path.len() > limits.depth {
            return Err(failure(ValidationErrorKind::Depth));
        }
        if !node
            .span
            .valid_child_of(*parent, previous_end, &document.source)
        {
            return Err(failure(ValidationErrorKind::InvalidSpan));
        }
        stats.payload_bytes = stats
            .payload_bytes
            .checked_add(node.payload_bytes())
            .filter(|bytes| *bytes <= limits.payload_bytes)
            .ok_or_else(|| failure(ValidationErrorKind::PayloadBytes))?;
        if let Err(payload) = node.validate() {
            let mut error = failure(ValidationErrorKind::InvalidNode);
            error.payload = Some(payload);
            return Err(error);
        }
        if node.children.len() > limits.nodes - scheduled {
            return Err(failure(ValidationErrorKind::Nodes));
        }
        scheduled += node.children.len();
        stats.nodes += 1;
        stats.depth = stats.depth.max(path.len());
        if node.children.is_empty() {
            path.pop();
        } else {
            stack.push((&node.children, node.span, 0));
        }
    }
    Ok(stats)
}
