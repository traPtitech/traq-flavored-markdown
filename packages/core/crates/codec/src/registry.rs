use crate::{CodecLimits, Error, ErrorKind, Result, fields::Fields};

use markdown_ast::{Document, NodeData, NodeKind, ValidatedDocument, ValidatedDocumentBuf};
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

    pub fn encode(&self, document: &Document) -> Result<Vec<u8>> {
        self.encode_with_limits(document, CodecLimits::default())
    }

    /// Encode a document with explicit JSON and tree limits.
    pub fn encode_with_limits(&self, document: &Document, limits: CodecLimits) -> Result<Vec<u8>> {
        crate::output::encode(document, self, limits)
    }

    pub fn encode_validated(&self, document: ValidatedDocument<'_>) -> Result<Vec<u8>> {
        self.encode_validated_with_limits(document, CodecLimits::default())
    }

    pub fn encode_validated_with_limits(
        &self,
        document: ValidatedDocument<'_>,
        limits: CodecLimits,
    ) -> Result<Vec<u8>> {
        crate::output::encode_validated(document, self, limits)
    }

    pub fn decode(&self, json: &[u8]) -> Result<Document> {
        self.decode_with_limits(json, CodecLimits::default())
    }

    pub fn decode_with_limits(&self, json: &[u8], limits: CodecLimits) -> Result<Document> {
        self.decode_validated_with_limits(json, limits)
            .map(ValidatedDocumentBuf::into_document)
    }

    pub fn decode_validated(&self, json: &[u8]) -> Result<ValidatedDocumentBuf> {
        self.decode_validated_with_limits(json, CodecLimits::default())
    }

    pub fn decode_validated_with_limits(
        &self,
        json: &[u8],
        limits: CodecLimits,
    ) -> Result<ValidatedDocumentBuf> {
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
