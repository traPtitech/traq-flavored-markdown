//! Bounded document framing; the caller supplies payload decoding.
use crate::{
    CodecLimits,
    fields::{Fields, error},
};
use markdown_ast::{Document, Node, NodeKind, Span};

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
    decode_kind: &dyn Fn(&str, Fields<'_>) -> serde_json::Result<NodeKind>,
) -> serde_json::Result<Document> {
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
    };

    let children = state.children(Some(children), parent, 1)?;
    Ok(Document { source, children })
}

fn check_json_limit(json: &[u8], limits: CodecLimits) -> serde_json::Result<()> {
    if json.len() > limits.json_bytes {
        return Err(error("json byte limit"));
    }

    Ok(())
}

fn decode_source(fields: &mut Fields<'_>, limits: CodecLimits) -> serde_json::Result<String> {
    let source: String = Deserialize::deserialize(fields.take("source")?)?;

    if source.len() > limits.document.source_bytes {
        return Err(error("source byte limit"));
    }

    Ok(source)
}

struct State<'a> {
    decode_kind: &'a dyn Fn(&str, Fields<'_>) -> serde_json::Result<NodeKind>,
    source: &'a str,
    limits: CodecLimits,
    count: usize,
    payload_bytes: usize,
}
impl State<'_> {
    fn node(
        &mut self,
        raw: &RawValue,
        parent: Span,
        previous_end: usize,
        depth: usize,
    ) -> serde_json::Result<Node> {
        self.check_limits(depth)?;
        self.count += 1;

        let mut fields: Fields<'_> = Deserialize::deserialize(raw)?;
        let span = self.span(&mut fields, parent, previous_end)?;

        let kind: String = Deserialize::deserialize(fields.take("kind")?)?;
        let raw_children = fields.0.remove("children");
        let kind = (self.decode_kind)(&kind, fields)?;

        self.payload_bytes = self
            .payload_bytes
            .checked_add(kind.payload_bytes())
            .filter(|bytes| *bytes <= self.limits.document.payload_bytes)
            .ok_or_else(|| error("payload byte limit"))?;

        let children = self.children(raw_children, span, depth + 1)?;
        if !kind.validate(&children) {
            return Err(error("invalid node shape"));
        }

        Ok(Node::new(span, kind, children))
    }

    fn check_limits(&self, depth: usize) -> serde_json::Result<()> {
        if self.count >= self.limits.document.nodes {
            return Err(error("node limit"));
        }

        if depth > self.limits.document.depth {
            return Err(error("depth limit"));
        }

        Ok(())
    }

    fn span(
        &self,
        fields: &mut Fields<'_>,
        parent: Span,
        previous_end: usize,
    ) -> serde_json::Result<Span> {
        let position: Position = Deserialize::deserialize(fields.take("span")?)?;

        let span = Span {
            start: position.start,
            end: position.end,
        };

        if !span.valid_child_of(parent, previous_end, self.source) {
            return Err(error("invalid span"));
        }

        Ok(span)
    }

    fn children(
        &mut self,
        raw: Option<&RawValue>,
        parent: Span,
        depth: usize,
    ) -> serde_json::Result<Vec<Node>> {
        match raw {
            Some(raw) => Children {
                state: self,
                parent,
                depth,
            }
            .deserialize(raw),
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
            let node = self
                .state
                .node(raw, self.parent, previous_end, self.depth)
                .map_err(S::Error::custom)?;
            previous_end = node.span.end;
            nodes.push(node);
        }

        Ok(nodes)
    }
}
