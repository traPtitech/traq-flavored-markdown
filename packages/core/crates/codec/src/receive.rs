//! Bounded document framing; the caller supplies payload decoding.
use crate::fields::{Fields, error};
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

#[derive(Clone, Copy)]
pub struct DecodeLimits {
    pub json_bytes: usize,
    pub source_bytes: usize,
    pub nodes: usize,
    pub depth: usize,
}

impl Default for DecodeLimits {
    fn default() -> Self {
        Self {
            json_bytes: 8 * 1024 * 1024,
            source_bytes: 65_536,
            nodes: 16_384,
            depth: 64,
        }
    }
}

pub(crate) fn decode(
    json: &[u8],
    limits: DecodeLimits,
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
    };

    let children = state.children(Some(children), parent, 1)?;
    Ok(Document { source, children })
}

fn check_json_limit(json: &[u8], limits: DecodeLimits) -> serde_json::Result<()> {
    if json.len() > limits.json_bytes {
        return Err(error("json byte limit"));
    }

    Ok(())
}

fn decode_source(fields: &mut Fields<'_>, limits: DecodeLimits) -> serde_json::Result<String> {
    let source: String = Deserialize::deserialize(fields.take("source")?)?;

    if source.len() > limits.source_bytes {
        return Err(error("source byte limit"));
    }

    Ok(source)
}

struct State<'a> {
    decode_kind: &'a dyn Fn(&str, Fields<'_>) -> serde_json::Result<NodeKind>,
    source: &'a str,
    limits: DecodeLimits,
    count: usize,
}
impl State<'_> {
    fn node(&mut self, raw: &RawValue, parent: Span, depth: usize) -> serde_json::Result<Node> {
        self.check_limits(depth)?;
        self.count += 1;

        let mut fields: Fields<'_> = Deserialize::deserialize(raw)?;
        let span = self.span(&mut fields, parent)?;

        let kind: String = Deserialize::deserialize(fields.take("kind")?)?;
        let raw_children = fields.0.remove("children");
        let kind = (self.decode_kind)(&kind, fields)?;

        let children = self.children(raw_children, span, depth + 1)?;
        if !kind.validate(&children) {
            return Err(error("invalid node shape"));
        }

        Ok(Node::new(span, kind, children))
    }

    fn check_limits(&self, depth: usize) -> serde_json::Result<()> {
        if self.count >= self.limits.nodes {
            return Err(error("node limit"));
        }

        if depth > self.limits.depth {
            return Err(error("depth limit"));
        }

        Ok(())
    }

    fn span(&self, fields: &mut Fields<'_>, parent: Span) -> serde_json::Result<Span> {
        let position: Position = Deserialize::deserialize(fields.take("span")?)?;

        let span = Span {
            start: position.start,
            end: position.end,
        };

        if span.start > span.end
            || span.start < parent.start
            || span.end > parent.end
            || !self.source.is_char_boundary(span.start)
            || !self.source.is_char_boundary(span.end)
        {
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

        while let Some(raw) = sequence.next_element::<&RawValue>()? {
            nodes.push(
                self.state
                    .node(raw, self.parent, self.depth)
                    .map_err(S::Error::custom)?,
            );
        }

        Ok(nodes)
    }
}
