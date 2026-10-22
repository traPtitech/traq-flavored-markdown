//! Bounded document framing; the caller supplies payload decoding.
use crate::{CodecLimits, Error as CodecError, ErrorKind, Result as CodecResult, fields::Fields};
use markdown_ast::{Document, Node, NodeKind, Span, ValidatedDocumentBuf};

use serde::{
    Deserialize, Deserializer,
    de::{DeserializeSeed, Error, SeqAccess, Visitor},
};

use serde_json::value::RawValue;
use std::fmt;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Position {
    start: usize,
    end: usize,
}

pub(crate) fn decode(
    json: &[u8],
    limits: CodecLimits,
    decode_kind: &dyn Fn(&str, Fields<'_>) -> CodecResult<NodeKind>,
) -> CodecResult<ValidatedDocumentBuf> {
    check_json_limit(json, limits)?;

    let mut fields: Fields<'_> = serde_json::from_slice(json)?;
    let source = decode_source(&mut fields, limits)?;

    let children = fields.take("children")?;
    fields.end()?;

    let parent = Span {
        start: 0,
        end: source.len(),
    };

    let mut state = State {
        decode_kind,
        source: &source,
        limits,
        count: 0,
        payload_bytes: 0,
        path: vec![],
        error: None,
    };

    let children = state.children(Some(children), parent, 1)?;
    Ok(ValidatedDocumentBuf::with_limits(
        Document { source, children },
        limits.document,
    )?)
}

fn check_json_limit(json: &[u8], limits: CodecLimits) -> CodecResult<()> {
    if json.len() > limits.json_bytes {
        return Err(limit("json_bytes", limits.json_bytes));
    }

    Ok(())
}

fn decode_source(fields: &mut Fields<'_>, limits: CodecLimits) -> CodecResult<String> {
    let source: String = Deserialize::deserialize(fields.take("source")?)?;

    if source.len() > limits.document.source_bytes {
        return Err(limit("source_bytes", limits.document.source_bytes));
    }

    Ok(source)
}

struct State<'a> {
    decode_kind: &'a dyn Fn(&str, Fields<'_>) -> CodecResult<NodeKind>,
    source: &'a str,
    limits: CodecLimits,
    count: usize,
    payload_bytes: usize,
    path: Vec<usize>,
    error: Option<CodecError>,
}
impl State<'_> {
    fn node(
        &mut self,
        raw: &RawValue,
        parent: Span,
        previous_end: usize,
        depth: usize,
    ) -> CodecResult<Node> {
        self.check_limits(depth)?;
        self.count += 1;

        let mut fields: Fields<'_> = Deserialize::deserialize(raw)?;
        let span = self.span(&mut fields, parent, previous_end)?;

        let kind: String = Deserialize::deserialize(fields.take("kind")?)?;
        let raw_children = fields.0.remove("children");
        let kind =
            (self.decode_kind)(&kind, fields).map_err(|error| error.at(&self.path, Some(span)))?;

        self.payload_bytes = self
            .payload_bytes
            .checked_add(kind.payload_bytes())
            .filter(|bytes| *bytes <= self.limits.document.payload_bytes)
            .ok_or_else(|| {
                limit("payload_bytes", self.limits.document.payload_bytes)
                    .at(&self.path, Some(span))
            })?;

        let children = self.children(raw_children, span, depth + 1)?;
        Ok(Node::new(span, kind, children))
    }

    fn check_limits(&self, depth: usize) -> CodecResult<()> {
        if self.count >= self.limits.document.nodes {
            return Err(limit("nodes", self.limits.document.nodes).at(&self.path, None));
        }

        if depth > self.limits.document.depth {
            return Err(limit("depth", self.limits.document.depth).at(&self.path, None));
        }

        Ok(())
    }

    fn span(
        &self,
        fields: &mut Fields<'_>,
        parent: Span,
        previous_end: usize,
    ) -> CodecResult<Span> {
        let position: Position = Deserialize::deserialize(fields.take("span")?)?;

        let span = Span {
            start: position.start,
            end: position.end,
        };

        if !span.valid_child_of(parent, previous_end, self.source) {
            return Err(CodecError::new(ErrorKind::InvalidSpan {
                parent,
                previous_end,
            })
            .at(&self.path, Some(span)));
        }

        Ok(span)
    }

    fn children(
        &mut self,
        raw: Option<&RawValue>,
        parent: Span,
        depth: usize,
    ) -> CodecResult<Vec<Node>> {
        match raw {
            Some(raw) => Children {
                state: self,
                parent,
                depth,
            }
            .deserialize(raw)
            .map_err(|error| {
                self.error
                    .take()
                    .unwrap_or_else(|| CodecError::from(error).at(&self.path, None))
            }),
            None => Ok(vec![]),
        }
    }
}

// Only validated, budgeted native nodes are allocated. Child JSON is borrowed.
// RawValue scanning can revisit ancestors; depth is capped at 64 by default.
struct Children<'a, 'b> {
    state: &'a mut State<'b>,
    parent: Span,
    depth: usize,
}
impl<'de> DeserializeSeed<'de> for Children<'_, '_> {
    type Value = Vec<Node>;

    fn deserialize<D: Deserializer<'de>>(self, deserializer: D) -> Result<Vec<Node>, D::Error> {
        deserializer.deserialize_seq(self)
    }
}

impl<'de> Visitor<'de> for Children<'_, '_> {
    type Value = Vec<Node>;

    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str("child nodes")
    }

    fn visit_seq<S: SeqAccess<'de>>(self, mut sequence: S) -> Result<Vec<Node>, S::Error> {
        let mut nodes = Vec::new();
        let mut previous_end = self.parent.start;

        while let Some(raw) = sequence.next_element::<&RawValue>()? {
            self.state.path.push(nodes.len());
            let node = match self.state.node(raw, self.parent, previous_end, self.depth) {
                Ok(node) => node,
                Err(error) => {
                    let error = error.at(&self.state.path, None);
                    let message = error.to_string();
                    self.state.error = Some(error);
                    return Err(S::Error::custom(message));
                }
            };
            self.state.path.pop();
            previous_end = node.span.end;
            nodes.push(node);
        }

        Ok(nodes)
    }
}

fn limit(resource: &'static str, limit: usize) -> CodecError {
    CodecError::new(ErrorKind::ResourceLimit { resource, limit })
}
