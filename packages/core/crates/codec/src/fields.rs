//! Borrow raw field values at the input boundary; never construct a JSON tree.
use serde::{
    Deserialize, Deserializer,
    de::{Error, MapAccess, Visitor},
};

use serde_json::value::RawValue;
use std::{collections::BTreeMap, fmt};

pub(crate) struct Fields<'a>(pub BTreeMap<String, &'a RawValue>);

impl<'de> Deserialize<'de> for Fields<'de> {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct Object;

        impl<'de> Visitor<'de> for Object {
            type Value = Fields<'de>;

            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("an object with distinct field names")
            }

            fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<Self::Value, M::Error> {
                let mut fields = BTreeMap::new();

                while let Some((key, value)) = map.next_entry::<String, &'de RawValue>()? {
                    if fields.contains_key(&key) {
                        return Err(M::Error::custom(format!("duplicate field {key:?}")));
                    }
                    fields.insert(key, value);
                }

                Ok(Fields(fields))
            }
        }

        deserializer.deserialize_map(Object)
    }
}

impl<'a> Fields<'a> {
    pub fn take(&mut self, name: &str) -> crate::Result<&'a RawValue> {
        self.0
            .remove(name)
            .ok_or_else(|| crate::Error::new(crate::ErrorKind::MissingField { name: name.into() }))
    }

    pub fn end(self) -> crate::Result<()> {
        if self.0.is_empty() {
            Ok(())
        } else {
            Err(crate::Error::new(crate::ErrorKind::UnknownFields {
                names: self.0.into_keys().collect(),
            }))
        }
    }
}
