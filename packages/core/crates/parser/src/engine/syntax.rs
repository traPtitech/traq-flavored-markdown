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
    nodes: Vec<Node>,
    syntax: Option<Vec<NodeSyntax>>,
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
            if nodes.is_empty() {
                return Ok(vec![]);
            }

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
    ) -> Result<(), ParseError> {
        if self.syntax.is_some() != children.syntax.is_some() {
            return Err(ParseError::InternalError);
        }

        self.nodes.push(Node::new(span, payload, children.nodes));

        if let Some(syntax) = &mut self.syntax {
            syntax.push(NodeSyntax {
                source,
                children: children.syntax.ok_or(ParseError::InternalError)?,
            });
        }

        Ok(())
    }

    pub fn into_parts(self, capture: bool) -> Result<(Vec<Node>, Vec<NodeSyntax>), ParseError> {
        match (capture, self.syntax) {
            (true, Some(syntax)) => Ok((self.nodes, syntax)),
            (false, None) => Ok((self.nodes, vec![])),
            _ => Err(ParseError::InternalError),
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

        if self.children.len() != document.children.len() {
            return Err(ParseError::invalid_rule(
                ParsePhase::Block,
                None,
                0,
                "syntax and AST root counts differ",
            ));
        }

        let mut pending: Vec<_> = self.children.iter().zip(&document.children).collect();

        while let Some((node, ast)) = pending.pop() {
            let phase = if ast.role() == crate::NodeRole::Inline {
                ParsePhase::Inline
            } else {
                ParsePhase::Block
            };

            budget.spend(1)?;

            if node.children.len() != ast.children.len() {
                return Err(ParseError::invalid_rule(
                    phase,
                    None,
                    ast.span.start,
                    "syntax and AST child counts differ",
                ));
            }

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Limits, MutableDocument, NodeData};

    #[derive(Debug, Clone, PartialEq)]
    struct Opaque;

    impl NodeData for Opaque {
        fn structure() -> &'static markdown_ast::NodeStructure {
            const { &markdown_ast::NodeStructure::opaque() }
        }

        fn payload_bytes(&self) -> usize {
            0
        }
    }

    #[test]
    fn capture_mismatches_are_rejected_before_appending_nodes() {
        let mut parsed = ParsedNodes::new(true);

        assert!(
            parsed
                .push(
                    Span { start: 0, end: 0 },
                    Opaque.into(),
                    ParsedNodes::new(false),
                    None
                )
                .is_err()
        );

        let (nodes, syntax) = parsed.into_parts(true).unwrap();
        assert!(nodes.is_empty());
        assert!(syntax.is_empty());
    }

    #[test]
    fn capture_counts_nodes_instead_of_empty_child_collections_for_nesting() {
        let span = Span { start: 0, end: 0 };
        let mut budget = Budget::new(Limits {
            nesting: 0,
            ..Limits::default()
        });

        let leaf =
            ParsedNodes::from_nodes(vec![Node::leaf(span, Opaque)], true, &mut budget).unwrap();

        assert_eq!(leaf.into_parts(true).unwrap().1, [NodeSyntax::default()]);

        assert!(
            ParsedNodes::from_nodes(
                vec![Node::new(span, Opaque, vec![Node::leaf(span, Opaque)])],
                true,
                &mut budget,
            )
            .is_err()
        );
    }

    #[test]
    fn validation_checks_root_and_nested_sibling_counts() {
        let span = Span { start: 0, end: 0 };
        let document = Document::new(MutableDocument {
            source: String::new(),
            children: vec![Node::new(span, Opaque, vec![Node::leaf(span, Opaque)])],
        })
        .unwrap();

        for children in [
            vec![],
            vec![NodeSyntax::default()],
            vec![NodeSyntax {
                source: None,
                children: vec![NodeSyntax::default(), NodeSyntax::default()],
            }],
        ] {
            let tree = SyntaxTree {
                children,
                detached: vec![],
            };

            assert!(
                tree.validate(&document, &mut Budget::new(Limits::default()))
                    .is_err()
            );
        }
    }
}
