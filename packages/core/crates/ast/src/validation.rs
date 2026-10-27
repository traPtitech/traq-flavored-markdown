use crate::{MutableDocument, Node, PayloadError, Span};

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
            payload_type: Some(node.payload_type_name()),
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
            write!(f, ": {payload}")?;
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
/// use markdown_ast::{MutableDocument, DocumentView};
/// let mut document = MutableDocument { source: String::new(), children: vec![] };
/// let validated = DocumentView::new(&document).unwrap();
/// document.source.push('x');
/// let _ = validated.document();
/// ```
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DocumentView<'a> {
    document: &'a MutableDocument,
    stats: ValidationStats,
}
impl<'a> DocumentView<'a> {
    pub fn new(document: &'a MutableDocument) -> Result<Self, ValidationError> {
        Self::with_limits(document, ValidationLimits::default())
    }
    pub fn with_limits(
        document: &'a MutableDocument,
        limits: ValidationLimits,
    ) -> Result<Self, ValidationError> {
        let stats = validate(document, limits)?;
        Ok(Self { document, stats })
    }
    pub fn document(self) -> &'a MutableDocument {
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
///
/// ```compile_fail
/// let mut document = markdown_ast::MutableDocument { source: String::new(), children: vec![] }.finish().unwrap();
/// document.source.push('x');
/// ```
#[derive(Debug, Clone, PartialEq)]
pub struct Document {
    document: MutableDocument,
    stats: ValidationStats,
}
impl Document {
    pub fn new(document: MutableDocument) -> Result<Self, ValidationError> {
        Self::with_limits(document, ValidationLimits::default())
    }
    pub fn with_limits(
        document: MutableDocument,
        limits: ValidationLimits,
    ) -> Result<Self, ValidationError> {
        let stats = validate(&document, limits)?;
        Ok(Self { document, stats })
    }
    pub fn as_view(&self) -> DocumentView<'_> {
        DocumentView {
            document: &self.document,
            stats: self.stats,
        }
    }
    pub fn document(&self) -> &MutableDocument {
        &self.document
    }
    pub fn into_mutable(self) -> MutableDocument {
        self.document
    }
}
impl MutableDocument {
    /// Validate an immutable borrow without taking ownership.
    pub fn validate(&self, limits: ValidationLimits) -> Result<DocumentView<'_>, ValidationError> {
        DocumentView::with_limits(self, limits)
    }
    /// Finish editing and retain the checked document for every consumer.
    pub fn finish(self) -> Result<Document, ValidationError> {
        Document::new(self)
    }
    pub fn finish_with_limits(self, limits: ValidationLimits) -> Result<Document, ValidationError> {
        Document::with_limits(self, limits)
    }
}
impl std::ops::Deref for Document {
    type Target = MutableDocument;
    fn deref(&self) -> &Self::Target {
        &self.document
    }
}
impl std::ops::Deref for DocumentView<'_> {
    type Target = MutableDocument;
    fn deref(&self) -> &Self::Target {
        self.document
    }
}
impl<'a> From<&'a Document> for DocumentView<'a> {
    fn from(document: &'a Document) -> Self {
        document.as_view()
    }
}
impl PartialEq<MutableDocument> for Document {
    fn eq(&self, other: &MutableDocument) -> bool {
        self.document == *other
    }
}

fn validate(
    document: &MutableDocument,
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

/// A consumer input. Checked owners and views reuse their proof; an editable
/// draft crosses the validation boundary before any consumer is invoked.
pub trait DocumentInput<'a> {
    fn into_view(self) -> Result<DocumentView<'a>, ValidationError>;
    fn into_view_with_limits(
        self,
        limits: ValidationLimits,
    ) -> Result<DocumentView<'a>, ValidationError>
    where
        Self: Sized,
    {
        let view = self.into_view()?;
        view.check_limits(limits)?;
        Ok(view)
    }
}
impl<'a> DocumentInput<'a> for DocumentView<'a> {
    fn into_view(self) -> Result<DocumentView<'a>, ValidationError> {
        Ok(self)
    }
}
impl<'a> DocumentInput<'a> for &'a Document {
    fn into_view(self) -> Result<DocumentView<'a>, ValidationError> {
        Ok(self.as_view())
    }
}
impl<'a> DocumentInput<'a> for &'a MutableDocument {
    fn into_view_with_limits(
        self,
        limits: ValidationLimits,
    ) -> Result<DocumentView<'a>, ValidationError> {
        DocumentView::with_limits(self, limits)
    }
    fn into_view(self) -> Result<DocumentView<'a>, ValidationError> {
        DocumentView::new(self)
    }
}
