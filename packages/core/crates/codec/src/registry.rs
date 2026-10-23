use crate::{CodecLimits, Error, ErrorKind, Result, fields::Fields};

use markdown_ast::{Document, NodeData, NodeKind};
use markdown_definitions::NodeType;

use serde::{
    Deserialize, Serialize,
    de::{DeserializeOwned, value::MapDeserializer},
};

use std::{any::TypeId, collections::HashMap};

pub(crate) struct Entry {
    pub name: String,
    pub borrow: fn(&NodeKind) -> &dyn erased_serde::Serialize,
    decode: fn(Fields<'_>) -> serde_json::Result<NodeKind>,
}

/// Reusable mapping between native payload types and generated wire keys.
#[derive(Default)]
pub struct Codec {
    pub(crate) entries: HashMap<TypeId, Entry>,
    names: HashMap<String, TypeId>,
}

impl Codec {
    /// Registration is atomic; duplicate types and names are rejected.
    pub fn register<T: NodeData + NodeType + Serialize + DeserializeOwned>(
        &mut self,
    ) -> Result<()> {
        let name = T::type_key();
        if name.is_empty() || name.chars().any(char::is_control) {
            return Err(Error::new(ErrorKind::InvalidContractKey {
                key: name,
                payload_type: std::any::type_name::<T>(),
            }));
        }

        let id = TypeId::of::<T>();
        if self.entries.contains_key(&id) || self.names.contains_key(&name) {
            return Err(Error::new(ErrorKind::DuplicateContract {
                key: name,
                payload_type: std::any::type_name::<T>(),
            }));
        }

        self.names.insert(name.clone(), id);

        self.entries.insert(
            id,
            Entry {
                name,
                borrow: |kind| kind.get::<T>().expect("registered type invariant"),
                decode: |fields| {
                    T::deserialize(MapDeserializer::new(fields.0.into_iter())).map(NodeKind::new)
                },
            },
        );

        Ok(())
    }

    pub fn encode<'a>(&'a self, document: impl markdown_ast::DocumentInput<'a>) -> Result<Vec<u8>> {
        self.encode_with_limits(document, CodecLimits::default())
    }
    pub fn encode_with_limits<'a>(
        &'a self,
        document: impl markdown_ast::DocumentInput<'a>,
        limits: CodecLimits,
    ) -> Result<Vec<u8>> {
        let mut output = Vec::new();
        self.encode_to_writer(document, &mut output, limits)?;
        Ok(output)
    }
    pub fn serialization_view<'a>(
        &'a self,
        document: impl markdown_ast::DocumentInput<'a>,
        limits: markdown_ast::ValidationLimits,
    ) -> Result<crate::SerializableDocument<'a>> {
        crate::SerializableDocument::new(self, document, limits)
    }
    pub fn encode_to_writer<'a>(
        &'a self,
        document: impl markdown_ast::DocumentInput<'a>,
        writer: impl std::io::Write,
        limits: CodecLimits,
    ) -> Result<()> {
        let document = self.serialization_view(document, limits.document)?;
        crate::write_json(writer, &document, limits.json_bytes)
    }
    pub fn decode(&self, json: &[u8]) -> Result<Document> {
        self.decode_with_limits(json, CodecLimits::default())
    }
    pub fn decode_with_limits(&self, json: &[u8], limits: CodecLimits) -> Result<Document> {
        crate::receive::decode(json, limits, &|name, mut fields| {
            let id = self
                .names
                .get(name)
                .ok_or_else(|| Error::new(ErrorKind::UnknownContract { name: name.into() }))?;
            let raw = fields.take("data")?;
            fields.end()?;
            Ok((self.entries[id].decode)(Deserialize::deserialize(raw)?)?)
        })
    }
}
