use super::{Budget, ParsePhase};
use crate::{AnyPayload, Document, Node, ParseError, Span};

/// Source facts supplied by syntax rules, independent of rendering policy.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MarkerKind {
    Open,
    Close,
    Prefix,
    Info,
    Separator,
    Definition,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SyntaxMarker {
    pub kind: MarkerKind,
    pub spans: Vec<Span>,
    /// Columns removed by a container prefix, measured in the parser view.
    pub columns: Option<usize>,
    /// Prefix spelling, restoring whole tabs while retaining partial tabs as spaces.
    pub text: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SourceSyntax {
    pub content: Vec<Span>,
    pub markers: Vec<SyntaxMarker>,
}

/// Position among siblings and children is identical to the accompanying AST.
/// `source: None` means a rule supplied no detailed source facts for this node.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct NodeSyntax {
    pub source: Option<SourceSyntax>,
    pub children: Vec<NodeSyntax>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SyntaxTree {
    pub children: Vec<NodeSyntax>,
    /// Accepted syntax that creates no AST node, such as reference definitions.
    pub detached: Vec<SyntaxMarker>,
}

#[derive(Debug)]
pub struct ParsedSyntax {
    pub document: Document,
    pub syntax: SyntaxTree,
}

pub(crate) struct CaptureSyntax;

pub(crate) struct ParsedNodes {
    pub nodes: Vec<Node>,
    pub syntax: Option<Vec<NodeSyntax>>,
}

impl ParsedNodes {
    pub fn new(capture: bool) -> Self {
        Self {
            nodes: vec![],
            syntax: capture.then(Vec::new),
        }
    }

    pub fn from_nodes(
        nodes: Vec<Node>,
        capture: bool,
        budget: &mut Budget,
    ) -> Result<Self, ParseError> {
        fn unknown(
            nodes: &[Node],
            budget: &mut Budget,
            depth: usize,
        ) -> Result<Vec<NodeSyntax>, ParseError> {
            budget.nesting(depth)?;
            budget.spend(nodes.len())?;
            nodes
                .iter()
                .map(|node| {
                    Ok(NodeSyntax {
                        source: None,
                        children: unknown(&node.children, budget, depth + 1)?,
                    })
                })
                .collect()
        }
        let syntax = if capture {
            Some(unknown(&nodes, budget, 0)?)
        } else {
            None
        };
        Ok(Self { nodes, syntax })
    }

    pub fn push(
        &mut self,
        span: Span,
        payload: AnyPayload,
        children: Self,
        source: Option<SourceSyntax>,
    ) {
        self.nodes.push(Node::new(span, payload, children.nodes));
        if let Some(syntax) = &mut self.syntax {
            syntax.push(NodeSyntax {
                source,
                children: children.syntax.unwrap_or_default(),
            });
        }
    }
}

impl SyntaxTree {
    pub(crate) fn validate(
        &self,
        document: &Document,
        budget: &mut Budget,
    ) -> Result<(), ParseError> {
        let source = document.source.as_str();
        let check = |span: Span, phase| {
            source.get(span.start..span.end).map(|_| ()).ok_or_else(|| {
                ParseError::invalid_rule(phase, None, span.start, "invalid source syntax span")
            })
        };
        let mut pending: Vec<_> = self.children.iter().zip(&document.children).collect();
        while let Some((node, ast)) = pending.pop() {
            let phase = if ast.role() == crate::NodeRole::Inline {
                ParsePhase::Inline
            } else {
                ParsePhase::Block
            };
            budget.spend(1)?;
            if let Some(facts) = &node.source {
                budget.spend(facts.content.len() + facts.markers.len())?;
                for &span in &facts.content {
                    check(span, phase)?;
                }
                for marker in &facts.markers {
                    budget.spend(marker.spans.len())?;
                    budget.spend(marker.text.as_ref().map_or(0, String::len))?;
                    for &span in &marker.spans {
                        check(span, phase)?;
                    }
                }
            }
            pending.extend(node.children.iter().zip(&ast.children));
        }
        budget.spend(self.detached.len())?;
        for marker in &self.detached {
            budget.spend(marker.spans.len())?;
            budget.spend(marker.text.as_ref().map_or(0, String::len))?;
            for &span in &marker.spans {
                check(span, ParsePhase::Block)?;
            }
        }
        Ok(())
    }
}
