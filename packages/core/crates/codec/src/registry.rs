use crate::{
    DecodeLimits,
    fields::{Fields, error},
};

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
    ) -> Result<(), &'static str> {
        let name = T::type_key();
        if name.is_empty() || name.chars().any(char::is_control) {
            return Err("invalid node type key");
        }

        let id = TypeId::of::<T>();
        if self.entries.contains_key(&id) || self.names.contains_key(&name) {
            return Err("duplicate Rust type or wire contract");
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

    pub fn encode(&self, document: &Document) -> serde_json::Result<Vec<u8>> {
        crate::output::encode(document, self)
    }

    pub fn decode(&self, json: &[u8]) -> serde_json::Result<Document> {
        self.decode_with_limits(json, DecodeLimits::default())
    }

    pub fn decode_with_limits(
        &self,
        json: &[u8],
        limits: DecodeLimits,
    ) -> serde_json::Result<Document> {
        crate::receive::decode(json, limits, &|name, mut fields| {
            let id = self
                .names
                .get(name)
                .ok_or_else(|| error("unknown contract"))?;

            let raw = fields.take("data")?;

            fields.end()?;
            (self.entries[id].decode)(Deserialize::deserialize(raw)?)
        })
    }
}
