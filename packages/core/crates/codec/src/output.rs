use super::{Codec, Error, ErrorKind, Result as CodecResult};
use markdown_ast::{DocumentInput, MutableDocument, Node, ValidationLimits};
use serde::{Serialize, Serializer};
use std::io::Write;

/// A checked serialization view borrowing its native document and contract registry.
/// Construct it through Codec::serialization_view; no JSON tree is allocated.
pub struct SerializableDocument<'a> {
    document: &'a MutableDocument,
    codec: &'a Codec,
}
impl<'a> SerializableDocument<'a> {
    pub(crate) fn new(
        codec: &'a Codec,
        document: impl DocumentInput<'a>,
        limits: ValidationLimits,
    ) -> CodecResult<Self> {
        let document = document.into_view_with_limits(limits)?;
        let mut path = vec![];
        for visit in document.walk() {
            path.truncate(visit.depth - 1);
            path.push(visit.index);
            if !codec.entries.contains_key(&visit.node.data_type_id()) {
                return Err(Error::new(ErrorKind::UnregisteredPayload {
                    payload_type: visit.node.data_type_name(),
                })
                .at(&path, Some(visit.node.span)));
            }
        }

        Ok(Self {
            document: document.document(),
            codec,
        })
    }
}

/// Serialize into a caller-owned sink, counting actual encoded JSON bytes.
/// A sink or payload serialization error is distinct from the byte budget.
pub fn write_json<W: Write, T: Serialize + ?Sized>(
    writer: W,
    value: &T,
    limit: usize,
) -> CodecResult<()> {
    let mut output = LimitedOutput {
        writer,
        written: 0,
        limit,
        exceeded: false,
    };
    serde_json::to_writer(&mut output, value).map_err(|error| {
        if output.exceeded {
            Error::new(ErrorKind::ResourceLimit {
                resource: "json_bytes",
                limit,
            })
        } else {
            error.into()
        }
    })
}
struct LimitedOutput<W> {
    writer: W,
    written: usize,
    limit: usize,
    exceeded: bool,
}
impl<W: Write> Write for LimitedOutput<W> {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        if bytes.len() > self.limit.saturating_sub(self.written) {
            self.exceeded = true;
            return Err(std::io::Error::other("json byte limit"));
        }
        let written = self.writer.write(bytes)?;
        self.written += written;
        Ok(written)
    }
    fn flush(&mut self) -> std::io::Result<()> {
        self.writer.flush()
    }
}

impl Serialize for SerializableDocument<'_> {
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
