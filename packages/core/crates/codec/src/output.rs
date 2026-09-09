use super::Codec;
use markdown_ast::{Document, Node, ValidationLimits};
use serde::{Serialize, Serializer};

pub(super) fn encode(document: &Document, codec: &Codec) -> serde_json::Result<Vec<u8>> {
    // Check before recursive serialization, including subtrees a renderer may hide.
    let limits = crate::DecodeLimits::default();

    document
        .validate(ValidationLimits {
            source_bytes: limits.source_bytes,
            nodes: limits.nodes,
            depth: limits.depth,
        })
        .map_err(<serde_json::Error as serde::ser::Error>::custom)?;

    let mut output = LimitedOutput {
        bytes: vec![],
        limit: limits.json_bytes,
    };

    serde_json::to_writer(&mut output, &DocumentOutput { document, codec })?;
    Ok(output.bytes)
}

struct LimitedOutput {
    bytes: Vec<u8>,
    limit: usize,
}

impl std::io::Write for LimitedOutput {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        if bytes.len() > self.limit.saturating_sub(self.bytes.len()) {
            return Err(std::io::Error::other("json byte limit"));
        }
        self.bytes.extend_from_slice(bytes);
        Ok(bytes.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

pub(super) struct DocumentOutput<'a> {
    pub document: &'a Document,
    pub codec: &'a Codec,
}

impl Serialize for DocumentOutput<'_> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        #[derive(Serialize)]
        struct Frame<'a> {
            source: &'a str,
            children: Children<'a>,
        }

        Frame {
            source: &self.document.source,
            children: Children {
                nodes: &self.document.children,
                codec: self.codec,
            },
        }
        .serialize(serializer)
    }
}
struct NodeOutput<'a> {
    node: &'a Node,
    codec: &'a Codec,
}

impl Serialize for NodeOutput<'_> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let entry = self
            .codec
            .entries
            .get(&self.node.kind.data_type_id())
            .ok_or_else(|| serde::ser::Error::custom("unregistered node type"))?;

        #[derive(Serialize)]
        struct Span {
            start: usize,
            end: usize,
        }

        #[derive(Serialize)]
        struct Frame<'a> {
            kind: &'a str,
            span: Span,
            data: &'a dyn erased_serde::Serialize,
            #[serde(skip_serializing_if = "Children::is_empty")]
            children: Children<'a>,
        }

        Frame {
            kind: &entry.name,
            span: Span {
                start: self.node.span.start,
                end: self.node.span.end,
            },
            data: (entry.borrow)(&self.node.kind),
            children: Children {
                nodes: &self.node.children,
                codec: self.codec,
            },
        }
        .serialize(serializer)
    }
}
struct Children<'a> {
    nodes: &'a [Node],
    codec: &'a Codec,
}

impl Children<'_> {
    fn is_empty(&self) -> bool {
        self.nodes.is_empty()
    }
}

impl Serialize for Children<'_> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.collect_seq(self.nodes.iter().map(|node| NodeOutput {
            node,
            codec: self.codec,
        }))
    }
}
